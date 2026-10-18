// Choix d'une adresse sur une carte : repère déplaçable, recherche d'adresse (proxy API), bouton
// « Ma position ». La wilaya et la commune sont déduites du point (commune au centre le plus proche).

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { nearestCommune, type LatLng } from '@ucolis/shared';
import { api } from '../api/client';
import { placeLabel } from '../format';
import { colors, fontFamily, MIN_TOUCH, radii, shadow, space } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export interface PickedPlace {
  address: string;
  wilayaCode: string;
  commune: string;
  location: LatLng;
}

type GeoResult = PickedPlace;

const ALGERIA: Region = { latitude: 34.5, longitude: 3, latitudeDelta: 9, longitudeDelta: 9 };

export function MapPicker({
  visible,
  title,
  initial,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  initial?: LatLng | null;
  onClose: () => void;
  onPick: (p: PickedPlace) => void;
}) {
  const { t } = useTranslation(['parcel', 'common']);
  const map = useRef<MapView>(null);
  const [point, setPoint] = useState<LatLng | null>(initial ?? null);
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setPoint(initial ?? null);
  }, [visible, initial]);

  // Adresse lisible du point (géocodage inverse par l'API, repli local).
  useEffect(() => {
    if (!point) return;
    const id = setTimeout(async () => {
      try {
        const r = await api.get<GeoResult>(`/geo/reverse?lat=${point.lat}&lng=${point.lng}`);
        setAddress(r.address);
      } catch {
        const near = nearestCommune(point);
        setAddress(placeLabel({ wilayaCode: near.wilayaCode, commune: near.communeCode }));
      }
    }, 400);
    return () => clearTimeout(id);
  }, [point]);

  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const id = setTimeout(async () => {
      try {
        setResults((await api.get<{ items: GeoResult[] }>(`/geo/search?q=${encodeURIComponent(query.trim())}`)).items);
      } catch {
        setResults([]);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [query]);

  function moveTo(p: LatLng) {
    setPoint(p);
    map.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
  }

  async function myPosition() {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      moveTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!point) return;
    const near = nearestCommune(point);
    onPick({ address: address || placeLabel({ wilayaCode: near.wilayaCode, commune: near.communeCode }), wilayaCode: near.wilayaCode, commune: near.communeCode, location: point });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <AppText size="lg" weight="bold" style={styles.flex}>
            {title}
          </AppText>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common:cancel')}>
            <Ionicons name="close" size={26} color={colors.navy} />
          </Pressable>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('searchAddress')}
            placeholderTextColor={colors.textSubtle}
            style={[styles.flex, styles.searchInput, { fontFamily: fontFamily() }]}
          />
        </View>
        {results.length > 0 && (
          <FlatList
            style={styles.results}
            data={results}
            keyExtractor={(r, i) => `${r.address}-${i}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.result}
                onPress={() => {
                  setResults([]);
                  setQuery('');
                  setAddress(item.address);
                  moveTo(item.location);
                }}
              >
                <Ionicons name="location-outline" size={18} color={colors.primary} />
                <AppText size="sm" style={styles.flex}>
                  {item.address}
                </AppText>
              </Pressable>
            )}
          />
        )}
        <View style={styles.flex}>
          <MapView
            ref={map}
            style={StyleSheet.absoluteFill}
            initialRegion={point ? { latitude: point.lat, longitude: point.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 } : ALGERIA}
            onPress={(e) => setPoint({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
          >
            {point && (
              <Marker
                coordinate={{ latitude: point.lat, longitude: point.lng }}
                draggable
                onDragEnd={(e) => setPoint({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
                pinColor={colors.primary}
              />
            )}
          </MapView>
          <Pressable style={styles.locate} onPress={myPosition} accessibilityRole="button" accessibilityLabel={t('common:myPosition')}>
            <Ionicons name={busy ? 'hourglass-outline' : 'locate'} size={22} color={colors.navy} />
          </Pressable>
        </View>
        <View style={styles.footer}>
          <AppText size="sm" numberOfLines={2} color={point ? colors.navy : colors.textMuted}>
            {point ? address : t('chooseOnMap')}
          </AppText>
          <Button label={t('confirmLocation')} onPress={confirm} disabled={!point} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: space(4) },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    marginHorizontal: space(4),
    marginBottom: space(2),
    paddingHorizontal: space(3),
    borderRadius: radii.input,
    backgroundColor: colors.background,
  },
  searchInput: { minHeight: MIN_TOUCH, color: colors.navy, textAlign: 'auto' },
  results: { maxHeight: 220, marginHorizontal: space(4) },
  result: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: MIN_TOUCH, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  locate: {
    position: 'absolute',
    end: space(4),
    bottom: space(4),
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  footer: { padding: space(4), gap: space(3) },
});
