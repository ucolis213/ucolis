// Recherche d'adresses façon VTC : champs Départ et Arrivée reliés, chacun avec ses icônes « Ma position actuelle »
// et « Choisir sur la carte » en fin de champ, adresses récentes, et suggestions pendant la frappe : communes du
// référentiel tout de suite, lieux et rues de l'API (OpenStreetMap ou Google) dès qu'ils arrivent.

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { AppModal } from './AppModal';

export type AddressField = 'pickup' | 'dropoff';

type Row =
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
  /** Champ dont la position est en cours de localisation, ou dont la carte est ouverte. */
  const [locating, setLocating] = useState<AddressField | null>(null);
  const [mapField, setMapField] = useState<AddressField | null>(null);
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

  /** Adresse choisie pour un champ (par défaut celui en cours de saisie), puis passage à l'autre s'il est vide. */
  async function choose(place: PickedPlace, f: AddressField = field) {
    const picked = toPlace(place);
    onSelect(f, picked);
    setRecents(await addRecent(picked));
    if (values[otherField(f)]) close();
    else switchField(otherField(f));
  }

  async function myPosition(f: AddressField) {
    setLocating(f);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return Alert.alert(t('locationDenied'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await choose(await reverse({ lat: pos.coords.latitude, lng: pos.coords.longitude }), f);
    } finally {
      setLocating(null);
    }
  }

  const typing = query.trim().length >= 2;
  const local = typing ? localSuggestions(query) : [];
  const places = withoutDuplicates(remote, local);
  const rows: Row[] = [];
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

  /** Icônes en fin de champ : position actuelle et choix sur la carte, pour ce champ. */
  const fieldActions = (f: AddressField) => (
    <View style={styles.fieldActions}>
      <Pressable
        onPress={() => myPosition(f)}
        disabled={locating !== null}
        hitSlop={4}
        style={styles.fieldAction}
        accessibilityRole="button"
        accessibilityLabel={`${t('myCurrentLocation')}, ${t(f)}`}
      >
        {locating === f ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="locate" size={20} color={colors.primary} />
        )}
      </Pressable>
      <Pressable
        onPress={() => setMapField(f)}
        hitSlop={4}
        style={styles.fieldAction}
        accessibilityRole="button"
        accessibilityLabel={`${t('chooseOnMap')}, ${t(f)}`}
      >
        <Ionicons name="map-outline" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );

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
          {fieldActions(f)}
        </View>
      );
    }
    return (
      <View style={styles.fieldRow}>
        <Pressable
          style={styles.fieldText}
          onPress={() => switchField(f)}
          accessibilityRole="button"
          accessibilityLabel={t(f)}
        >
          <AppText numberOfLines={1} color={value ? colors.navy : colors.textSubtle}>
            {value?.address ?? placeholder}
          </AppText>
        </Pressable>
        {fieldActions(f)}
      </View>
    );
  };

  const renderRow = ({ item }: { item: Row }) => {
    switch (item.kind) {
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
    <AppModal visible={visible} animationType="slide" onRequestClose={close}>
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
          visible={mapField !== null}
          title={t(mapField ?? field)}
          initial={
            mapField
              ? (values[mapField]?.location ?? values[otherField(mapField)]?.location ?? null)
              : null
          }
          onClose={() => setMapField(null)}
          onPick={(p) => {
            const f = mapField ?? field;
            setMapField(null);
            void choose(p, f);
          }}
        />
      </SafeAreaView>
    </AppModal>
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
  fieldText: { flex: 1, minHeight: MIN_TOUCH, justifyContent: 'center' },
  fieldActions: { flexDirection: 'row', alignItems: 'center' },
  fieldAction: { width: 40, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingTop: space(4),
    paddingBottom: space(1),
  },
  note: { paddingTop: space(2) },
});
