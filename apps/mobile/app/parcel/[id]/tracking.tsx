// Suivi en direct (F12) côté expéditeur : marqueur du transporteur orienté selon son cap, dernière
// position demandée à l'ouverture, « Mis à jour il y a X s », alerte au-delà de 5 min sans position.

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TRACKING_STALE_AFTER_MS } from '@ucolis/shared';
import { useParcel } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LoadingSkeleton } from '@/components/QueryView';
import { RouteMap } from '@/components/RouteMap';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatRelative } from '@/format';
import { emitWithAck, useSocket, useSocketEvent } from '@/realtime/socket';
import { colors, radii, space } from '@/theme';

interface Position {
  parcelId: string;
  lat: number;
  lng: number;
  heading: number | null;
  receivedAt: string;
}

export default function Tracking() {
  const { t } = useTranslation(['parcel', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const parcel = useParcel(id);
  const { socket, connected } = useSocket();
  const qc = useQueryClient();
  const [position, setPosition] = useState<Position | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Room de suivi rejointe à chaque (re)connexion, dernière position demandée au serveur.
  useEffect(() => {
    if (!socket || !connected) return;
    void emitWithAck(socket, 'tracking:join', { parcelId: id }).catch(() => undefined);
    void emitWithAck<Position | null>(socket, 'tracking:last', { parcelId: id })
      .then((last) => last && setPosition(last))
      .catch(() => undefined);
    return () => {
      socket.emit('tracking:leave', { parcelId: id });
    };
  }, [socket, connected, id]);

  useSocketEvent<Position>('tracking:update', (p) => {
    if (p.parcelId === id) setPosition(p);
  });
  useSocketEvent<{ parcelId: string }>('tracking:stopped', (p) => {
    if (p.parcelId === id) void qc.invalidateQueries({ queryKey: ['parcel', id] });
  });

  const p = parcel.data;
  if (!p) {
    return (
      <Screen header={<ScreenHeader title={t('tracking.title')} />}>
        <LoadingSkeleton rows={2} height={200} />
      </Screen>
    );
  }
  const stale = position && now - new Date(position.receivedAt).getTime() > TRACKING_STALE_AFTER_MS;

  return (
    <Screen padded={false} edges={['top', 'bottom']} header={<ScreenHeader title={t('tracking.title')} />}>
      <View style={styles.flex}>
        <RouteMap from={p.pickup.location} to={p.dropoff.location} carrier={position} height={9999} interactive showOpen={false} />
      </View>
      <View style={styles.panel}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: connected ? colors.accent : colors.warning }]} />
          <AppText size="sm" color={colors.textMuted}>
            {connected ? t('tracking.connected') : t('tracking.reconnecting')}
          </AppText>
        </View>
        {p.status !== 'in_transit' ? (
          <AppText weight="semibold">{t(`common:parcelStatus.${p.status}`)}</AppText>
        ) : position ? (
          <AppText weight="semibold" color={stale ? colors.danger : colors.navy}>
            {stale ? t('tracking.stale') : t('tracking.updated', { ago: formatRelative(position.receivedAt, new Date(now)) })}
          </AppText>
        ) : (
          <AppText weight="semibold" color={colors.textMuted}>
            {t('tracking.waiting')}
          </AppText>
        )}
        <View style={styles.row}>
          {p.viewer.counterpartPhone && (
            <View style={styles.flex}>
              <Button label={t('common:call')} icon="call-outline" variant="outline" onPress={() => Linking.openURL(`tel:${p.viewer.counterpartPhone}`)} />
            </View>
          )}
          {p.viewer.conversationId && (
            <View style={styles.flex}>
              <Button
                label={t('actions.message')}
                icon="chatbubble-outline"
                variant="outline"
                onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: p.viewer.conversationId! } })}
              />
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { padding: space(5), gap: space(3), backgroundColor: colors.surface, borderTopLeftRadius: radii.card * 2, borderTopRightRadius: radii.card * 2, marginTop: -space(5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
