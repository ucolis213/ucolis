// Mini-carte : départ, arrivée et ligne droite (distance à vol d'oiseau), position du transporteur en suivi.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import type { LatLng } from '@ucolis/shared';
import { colors, radii, space } from '../theme';
import { AppText } from './AppText';

export function openInMaps(p: LatLng, label: string) {
  const q = encodeURIComponent(label);
  const url = Platform.select({
    ios: `http://maps.apple.com/?ll=${p.lat},${p.lng}&q=${q}`,
    default: `geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${q})`,
  });
  void Linking.openURL(url);
}

export function RouteMap({
  from,
  to,
  carrier,
  height = 180,
  interactive = false,
  showOpen = true,
}: {
  from: LatLng;
  to: LatLng;
  carrier?: (LatLng & { heading?: number | null }) | null;
  height?: number;
  interactive?: boolean;
  showOpen?: boolean;
}) {
  const { t } = useTranslation('common');
  const map = useRef<MapView>(null);
  const coords = [from, to, ...(carrier ? [carrier] : [])].map((p) => ({ latitude: p.lat, longitude: p.lng }));

  useEffect(() => {
    const id = setTimeout(
      () => map.current?.fitToCoordinates(coords, { edgePadding: { top: 40, bottom: 40, left: 40, right: 40 }, animated: false }),
      300,
    );
    return () => clearTimeout(id);
    // Recadrage seulement sur le trajet ; la position du transporteur bouge en continu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.lat, from.lng, to.lat, to.lng]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        initialRegion={{ latitude: (from.lat + to.lat) / 2, longitude: (from.lng + to.lng) / 2, latitudeDelta: 5, longitudeDelta: 5 }}
      >
        <Marker coordinate={coords[0]!} pinColor={colors.primary} title={t('from')} />
        <Marker coordinate={coords[1]!} pinColor={colors.navy} title={t('to')} />
        <Polyline coordinates={[coords[0]!, coords[1]!]} strokeColor={colors.primary} strokeWidth={3} lineDashPattern={[8, 6]} />
        {carrier && (
          <Marker coordinate={{ latitude: carrier.lat, longitude: carrier.lng }} anchor={{ x: 0.5, y: 0.5 }} flat rotation={carrier.heading ?? 0}>
            <View style={styles.carrier}>
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
            </View>
          </Marker>
        )}
      </MapView>
      {showOpen && (
        <Pressable style={styles.open} onPress={() => openInMaps(to, t('to'))} accessibilityRole="button">
          <Ionicons name="map-outline" size={16} color={colors.navy} />
          <AppText size="xs" weight="semibold">
            {t('openInMaps')}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.border },
  carrier: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  open: {
    position: 'absolute',
    end: space(2),
    bottom: space(2),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radii.chip,
    backgroundColor: colors.surface,
  },
});
