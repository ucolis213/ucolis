// Choix d'un point sur la carte : le repère reste fixe au centre et l'on fait glisser la carte dessous ;
// l'adresse du point (géocodage inverse par l'API, repli local) s'affiche dès que la carte s'arrête.
// La wilaya et la commune sont déduites du point (commune au centre le plus proche).

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { nearestCommune, type LatLng } from '@ucolis/shared';
import { api } from '../api/client';
import { placeLabel } from '../format';
import { toPlace } from '../state/addressBook';
import { backIcon, colors, MIN_TOUCH, shadow, space } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export interface PickedPlace {
  address: string;
  wilayaCode: string;
  commune: string;
  location: LatLng;
}

type GeoResult = PickedPlace & { name?: string };

const ALGERIA: Region = { latitude: 34.5, longitude: 3, latitudeDelta: 9, longitudeDelta: 9 };
const STREET_DELTA = 0.01;
/** Au-delà, la carte est trop éloignée pour désigner un point précis. */
const MAX_PICK_DELTA = 0.2;
const PIN_SIZE = 44;

const regionAt = (p: LatLng): Region => ({
  latitude: p.lat,
  longitude: p.lng,
  latitudeDelta: STREET_DELTA,
  longitudeDelta: STREET_DELTA,
});

function localPlace(point: LatLng): GeoResult {
  const near = nearestCommune(point);
  return {
    address: placeLabel({ wilayaCode: near.wilayaCode, commune: near.communeCode }),
    wilayaCode: near.wilayaCode,
    commune: near.communeCode,
    location: point,
  };
}

interface MapPickerProps {
  visible: boolean;
  title: string;
  initial?: LatLng | null;
  onClose: () => void;
  onPick: (p: PickedPlace) => void;
}

export function MapPicker({ visible, ...props }: MapPickerProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={props.onClose}>
      {/* Contenu créé à chaque ouverture : la carte repart du point initial, sans état résiduel. */}
      {visible && <MapPickerContent {...props} />}
    </Modal>
  );
}

function MapPickerContent({ title, initial, onClose, onPick }: Omit<MapPickerProps, 'visible'>) {
  const { t } = useTranslation(['parcel', 'common']);
  const map = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(initial ? regionAt(initial) : ALGERIA);
  const [place, setPlace] = useState<GeoResult | null>(null);
  const [locating, setLocating] = useState(false);
  const zoomedIn = region.latitudeDelta <= MAX_PICK_DELTA;
  // L'adresse affichée correspond-elle au centre actuel de la carte ?
  const resolving =
    zoomedIn &&
    (place?.location.lat !== region.latitude || place?.location.lng !== region.longitude);

  // Sans point initial : dernière position connue, sans demander d'autorisation.
  useEffect(() => {
    if (initial) return;
    void (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      const last = await Location.getLastKnownPositionAsync();
      if (last)
        map.current?.animateToRegion(
          regionAt({ lat: last.coords.latitude, lng: last.coords.longitude }),
          400,
        );
    })();
  }, [initial]);

  // Adresse du centre une fois la carte immobile (délai pour ne pas interroger l'API à chaque glissement).
  useEffect(() => {
    if (!zoomedIn) return;
    const point = { lat: region.latitude, lng: region.longitude };
    let cancelled = false;
    const id = setTimeout(async () => {
      let found: GeoResult;
      try {
        found = await api.get<GeoResult>(`/geo/reverse?lat=${point.lat}&lng=${point.lng}`);
      } catch {
        found = localPlace(point);
      }
      if (!cancelled) setPlace({ ...found, location: point });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [zoomedIn, region.latitude, region.longitude]);

  async function myPosition() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return Alert.alert(t('locationDenied'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      map.current?.animateToRegion(
        regionAt({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        400,
      );
    } finally {
      setLocating(false);
    }
  }

  function confirm() {
    if (place) onPick(toPlace(place));
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('common:back')}
        >
          <Ionicons name={backIcon()} size={24} color={colors.navy} />
        </Pressable>
        <AppText size="lg" weight="bold" style={styles.flex} numberOfLines={1}>
          {title}
        </AppText>
      </View>
      <View style={styles.flex}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={initial ? regionAt(initial) : ALGERIA}
          onRegionChangeComplete={setRegion}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
        />
        <View style={styles.pinLayer} pointerEvents="none">
          <Ionicons name="location" size={PIN_SIZE} color={colors.primary} style={styles.pin} />
        </View>
        <Pressable
          style={styles.locate}
          onPress={myPosition}
          accessibilityRole="button"
          accessibilityLabel={t('common:myPosition')}
        >
          {locating ? (
            <ActivityIndicator color={colors.navy} />
          ) : (
            <Ionicons name="locate" size={22} color={colors.navy} />
          )}
        </Pressable>
      </View>
      <View style={styles.footer}>
        <View style={styles.addressRow}>
          {resolving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons
              name="location-outline"
              size={20}
              color={zoomedIn ? colors.primary : colors.textSubtle}
            />
          )}
          <View style={styles.flex}>
            {!zoomedIn ? (
              <AppText size="sm" color={colors.textMuted}>
                {t('moveMapHint')}
              </AppText>
            ) : place && !resolving ? (
              <>
                {place.name && (
                  <AppText weight="semibold" numberOfLines={1}>
                    {place.name}
                  </AppText>
                )}
                <AppText
                  size="sm"
                  numberOfLines={2}
                  color={place.name ? colors.textMuted : colors.navy}
                >
                  {place.address}
                </AppText>
              </>
            ) : null}
          </View>
        </View>
        <Button
          label={t('confirmLocation')}
          onPress={confirm}
          disabled={!zoomedIn || !place || resolving}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(2),
    paddingVertical: space(2),
  },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  // La pointe du repère désigne exactement le centre de la carte.
  pinLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pin: { marginTop: -PIN_SIZE },
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
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 44 },
});
