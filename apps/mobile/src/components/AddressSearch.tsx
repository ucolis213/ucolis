// Recherche d'adresses façon VTC : champs Départ et Arrivée reliés, « Ma position actuelle », « Choisir sur la
// carte », adresses récentes, et suggestions pendant la frappe : communes du référentiel tout de suite, lieux et
// rues de l'API (OpenStreetMap ou Google) dès qu'ils arrivent.

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { nearestCommune, type LatLng } from '@ucolis/shared';
import { api } from '../api/client';
import { placeLabel } from '../format';
import {
  addRecent,
  loadRecents,
  localSuggestions,
  toPlace,
  withoutDuplicates,
  type AddressSuggestion,
} from '../state/addressBook';
import { backIcon, colors, fontFamily, MIN_TOUCH, radii, space } from '../theme';
import { AppText } from './AppText';
import { MapPicker, type PickedPlace } from './MapPicker';

export type AddressField = 'pickup' | 'dropoff';

type Row =
  | { kind: 'action'; id: 'position' | 'map' }
  | { kind: 'header'; id: string; label: string; loading?: boolean }
  | { kind: 'place'; id: string; place: AddressSuggestion; icon: keyof typeof Ionicons.glyphMap }
  | { kind: 'note'; id: string; label: string };

const otherField = (f: AddressField): AddressField => (f === 'pickup' ? 'dropoff' : 'pickup');

async function reverse(point: LatLng): Promise<AddressSuggestion> {
  try {
    return {
      ...(await api.get<AddressSuggestion>(`/geo/reverse?lat=${point.lat}&lng=${point.lng}`)),
      location: point,
    };
  } catch {
    const near = nearestCommune(point);
    return {
      address: placeLabel({ wilayaCode: near.wilayaCode, commune: near.communeCode }),
      wilayaCode: near.wilayaCode,
      commune: near.communeCode,
      location: point,
    };
  }
}

export function AddressSearch({
  visible,
  field,
  values,
  onSelect,
  onFieldChange,
  onClose,
}: {
  visible: boolean;
  /** Champ en cours de saisie. */
  field: AddressField;
  values: Record<AddressField, PickedPlace | null>;
  onSelect: (field: AddressField, place: PickedPlace) => void;
  onFieldChange: (field: AddressField) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['parcel', 'common']);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<PickedPlace[]>([]);
  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (visible) void loadRecents().then(setRecents);
  }, [visible]);

  function changeQuery(text: string) {
    setQuery(text);
    setRemote([]);
    setSearching(text.trim().length >= 2);
  }

  // Changement de champ ou fermeture : saisie vierge.
  function switchField(f: AddressField) {
    changeQuery('');
    onFieldChange(f);
  }

  function close() {
    changeQuery('');
    onClose();
  }

  // Lieux et rues par l'API ; seule la réponse à la dernière saisie est gardée.
  useEffect(() => {
    const q = query.trim();
    const id = ++requestId.current;
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const { items } = await api.get<{ items: AddressSuggestion[] }>(
          `/geo/search?q=${encodeURIComponent(q)}`,
        );
        if (id === requestId.current) setRemote(items);
      } catch {
        // Les communes locales restent proposées.
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function choose(place: PickedPlace) {
    const picked = toPlace(place);
    onSelect(field, picked);
    setRecents(await addRecent(picked));
    if (values[otherField(field)]) close();
    else switchField(otherField(field));
  }

  async function myPosition() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return Alert.alert(t('locationDenied'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await choose(await reverse({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
    } finally {
      setLocating(false);
    }
  }

  const typing = query.trim().length >= 2;
  const local = typing ? localSuggestions(query) : [];
  const places = withoutDuplicates(remote, local);
  const rows: Row[] = [
    { kind: 'action', id: 'position' },
    { kind: 'action', id: 'map' },
  ];
  if (!typing && recents.length) {
    rows.push({ kind: 'header', id: 'h-recents', label: t('recentAddresses') });
    recents.forEach((p, i) =>
      rows.push({ kind: 'place', id: `r-${i}`, place: p, icon: 'time-outline' }),
    );
  }
  if (typing) {
    if (local.length) {
      rows.push({ kind: 'header', id: 'h-communes', label: t('communesSection') });
      local.forEach((p) =>
        rows.push({ kind: 'place', id: `c-${p.commune}`, place: p, icon: 'business-outline' }),
      );
    }
    if (searching || places.length) {
      rows.push({
        kind: 'header',
        id: 'h-places',
        label: searching ? t('searchingPlaces') : t('placesSection'),
        loading: searching,
      });
      places.forEach((p, i) =>
        rows.push({ kind: 'place', id: `p-${i}`, place: p, icon: 'location-outline' }),
      );
      if (places.length) rows.push({ kind: 'note', id: 'osm', label: t('osmAttribution') });
    }
    if (!searching && !local.length && !places.length)
      rows.push({ kind: 'note', id: 'empty', label: t('noAddressResult') });
  }

  const fieldRow = (f: AddressField) => {
    const value = values[f];
    const placeholder = t(f === 'pickup' ? 'whereFrom' : 'whereTo');
    if (f === field) {
      return (
        <View style={styles.fieldRow}>
          <TextInput
            value={query}
            onChangeText={changeQuery}
            autoFocus
            placeholder={value?.address ?? placeholder}
            placeholderTextColor={value ? colors.navy : colors.textSubtle}
            style={[styles.input, { fontFamily: fontFamily() }]}
            returnKeyType="search"
            accessibilityLabel={t(f)}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => changeQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common:clear')}
            >
              <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
            </Pressable>
          )}
        </View>
      );
    }
    return (
      <Pressable
        style={styles.fieldRow}
        onPress={() => switchField(f)}
        accessibilityRole="button"
        accessibilityLabel={t(f)}
      >
        <AppText
          numberOfLines={1}
          color={value ? colors.navy : colors.textSubtle}
          style={styles.flex}
        >
          {value?.address ?? placeholder}
        </AppText>
      </Pressable>
    );
  };

  const renderRow = ({ item }: { item: Row }) => {
    switch (item.kind) {
      case 'action': {
        const isMap = item.id === 'map';
        return (
          <Pressable
            style={styles.row}
            onPress={isMap ? () => setMapOpen(true) : myPosition}
            accessibilityRole="button"
            accessibilityLabel={t(isMap ? 'chooseOnMap' : 'myCurrentLocation')}
          >
            <View style={styles.actionIcon}>
              {!isMap && locating ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons
                  name={isMap ? 'map-outline' : 'locate'}
                  size={20}
                  color={colors.primary}
                />
              )}
            </View>
            <AppText weight="medium" style={styles.flex}>
              {t(isMap ? 'chooseOnMap' : 'myCurrentLocation')}
            </AppText>
          </Pressable>
        );
      }
      case 'header':
        return (
          <View style={styles.header}>
            <AppText size="xs" weight="semibold" color={colors.textMuted}>
              {item.label}
            </AppText>
            {item.loading && <ActivityIndicator size="small" color={colors.textMuted} />}
          </View>
        );
      case 'note':
        return (
          <AppText size="xs" color={colors.textSubtle} style={styles.note}>
            {item.label}
          </AppText>
        );
      case 'place':
        return (
          <Pressable
            style={styles.row}
            onPress={() => choose(item.place)}
            accessibilityRole="button"
            accessibilityLabel={item.place.address}
          >
            <Ionicons name={item.icon} size={20} color={colors.textMuted} />
            <View style={styles.flex}>
              <AppText weight={item.place.name ? 'semibold' : 'regular'} numberOfLines={1}>
                {item.place.name ?? item.place.address}
              </AppText>
              {item.place.name && (
                <AppText size="xs" color={colors.textMuted} numberOfLines={1}>
                  {item.place.address}
                </AppText>
              )}
            </View>
          </Pressable>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Pressable
            onPress={close}
            hitSlop={12}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel={t('common:back')}
          >
            <Ionicons name={backIcon()} size={24} color={colors.navy} />
          </Pressable>
          <AppText size="lg" weight="bold">
            {t('steps.route')}
          </AppText>
        </View>
        <View style={styles.fields}>
          {/* Repères reliés : rond pour le départ, carré pour l'arrivée. */}
          <View style={styles.rail}>
            <View style={styles.dot} />
            <View style={styles.line} />
            <View style={styles.square} />
          </View>
          <View style={styles.flex}>
            {fieldRow('pickup')}
            <View style={styles.divider} />
            {fieldRow('dropoff')}
          </View>
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
        />
        <MapPicker
          visible={mapOpen}
          title={t(field)}
          initial={values[field]?.location ?? values[otherField(field)]?.location ?? null}
          onClose={() => setMapOpen(false)}
          onPick={(p) => {
            setMapOpen(false);
            void choose(p);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(2),
    paddingVertical: space(2),
  },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  fields: {
    flexDirection: 'row',
    gap: space(3),
    marginHorizontal: space(4),
    paddingHorizontal: space(3),
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  rail: { alignItems: 'center', paddingVertical: space(5) },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  line: { flex: 1, width: 2, marginVertical: space(1), backgroundColor: colors.border },
  square: { width: 10, height: 10, backgroundColor: colors.navy },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: MIN_TOUCH + 4 },
  input: { flex: 1, minHeight: MIN_TOUCH, color: colors.navy, fontSize: 16, textAlign: 'auto' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  list: { paddingHorizontal: space(4), paddingBottom: space(6) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    minHeight: MIN_TOUCH + 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actionIcon: { width: 20, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingTop: space(4),
    paddingBottom: space(1),
  },
  note: { paddingTop: space(2) },
});
