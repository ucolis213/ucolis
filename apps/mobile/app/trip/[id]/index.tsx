// Détail d'un trajet (F9). Transporteur : colis compatibles, propositions reçues, statut (complet,
// rouvrir, annuler). Expéditeur : « Proposer mon colis » parmi ses colis compatibles.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { isParcelCompatibleWithTrip, type Paginated, type ParcelCardDto, type ParcelDto } from '@ucolis/shared';
import { api, errorMessage, qs } from '@/api/client';
import { useMatchingParcels, useTrip, useTripRequests } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { confirm } from '@/components/ConfirmDialog';
import { KeyValue, SectionCard } from '@/components/FormBits';
import { ParcelCard } from '@/components/ParcelCard';
import { QueryView } from '@/components/QueryView';
import { RouteMap } from '@/components/RouteMap';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UserRow } from '@/components/UserRow';
import { formatDate, formatDateTime, price, wilayaName } from '@/format';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useSession } from '@/session/SessionContext';
import { colors, space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function TripDetail() {
  const { t } = useTranslation(['trip', 'parcel', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const trip = useTrip(id);
  const pull = usePullToRefresh(trip.refetch);
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();
  const isOwner = !!user && trip.data?.carrier.id === user.id;
  const matching = useMatchingParcels(id, isOwner);
  const requests = useTripRequests();
  const [choosing, setChoosing] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      void qc.invalidateQueries({ queryKey: ['trip', id] });
      void qc.invalidateQueries({ queryKey: ['me', 'trips'] });
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('departure')} />} {...pull}>
      <QueryView query={trip}>
        {(tr) => {
          const received = (requests.data?.received ?? []).filter((r) => r.tripId === id && r.status === 'pending');
          return (
            <View style={{ gap: space(4) }}>
              <AppText size="xl" weight="bold">
                {[tr.from.wilayaCode, ...tr.stops, tr.to.wilayaCode].map(wilayaName).join(' → ')}
              </AppText>
              <RouteMap from={tr.from.location} to={tr.to.location} />
              <SectionCard>
                <KeyValue label={t('departure')} value={formatDateTime(tr.departureAt)} />
                <KeyValue label={t('parcel:vehicleTypesLabel')} value={`${t(`parcel:vehicleTypes.${tr.vehicle.type}`)} ${tr.vehicle.brand ?? ''} ${tr.vehicle.model ?? ''}`} />
                <KeyValue label={t('capacityKg')} value={`${tr.capacityKg} kg`} />
                <KeyValue label={t('capacityM3')} value={`${tr.capacityM3} m³`} />
                {tr.priceHint && <KeyValue label={t('priceHint')} value={`${price(tr.priceHint.amount)}${tr.priceHint.mode === 'per_kg' ? ' / kg' : ''}`} />}
                {tr.recurrence && <KeyValue label={t('recurrence')} value={`${tr.recurrence.weekdays.map((d) => (t('days', { returnObjects: true }) as string[])[d]).join(', ')} · ${t('until')} ${formatDate(tr.recurrence.until)}`} />}
                <KeyValue label="" value={t(`statuses.${tr.status}`)} />
                {tr.note && <AppText size="sm">{tr.note}</AppText>}
              </SectionCard>
              {!isOwner && (
                <SectionCard title={t('parcel:carrier')}>
                  <UserRow user={tr.carrier} plain />
                </SectionCard>
              )}

              {isOwner ? (
                <>
                  <View style={styles.row}>
                    {tr.status === 'active' && <Button label={t('markFull')} variant="outline" fullWidth={false} onPress={() => run(() => api.post(`/trips/${id}/status`, { status: 'full' }))} />}
                    {tr.status === 'full' && <Button label={t('markActive')} variant="outline" fullWidth={false} onPress={() => run(() => api.post(`/trips/${id}/status`, { status: 'active' }))} />}
                    {['active', 'full'].includes(tr.status) && (
                      <>
                        <Button label={t('common:edit')} variant="outline" fullWidth={false} onPress={() => router.push({ pathname: '/trip/[id]/edit', params: { id } })} />
                        <Button
                          label={t('cancel')}
                          variant="ghost"
                          fullWidth={false}
                          onPress={async () => (await confirm({ title: t('cancel'), destructive: true })) && run(() => api.post(`/trips/${id}/status`, { status: 'cancelled' }))}
                        />
                      </>
                    )}
                  </View>
                  {received.length > 0 && (
                    <View style={{ gap: space(3) }}>
                      <AppText weight="bold">{t('requests')}</AppText>
                      {received.map((r) =>
                        r.parcel ? (
                          <View key={r.id} style={{ gap: space(2) }}>
                            <ParcelCard parcel={r.parcel} />
                            <View style={styles.row}>
                              <View style={styles.flex}>
                                <Button label={t('makeOffer')} onPress={() => router.push({ pathname: '/parcel/[id]/make-offer', params: { id: r.parcel!.id } })} />
                              </View>
                              <Button label={t('decline')} variant="ghost" fullWidth={false} onPress={() => run(() => api.post(`/trip-requests/${r.id}/decline`).then(() => requests.refetch()))} />
                            </View>
                          </View>
                        ) : null,
                      )}
                    </View>
                  )}
                  <AppText weight="bold">{t('matching')}</AppText>
                  <QueryView query={matching} isEmpty={(d) => d.items.length === 0} empty={{ icon: 'cube-outline', title: t('noMatching') }}>
                    {(d) => (
                      <View style={{ gap: space(3) }}>
                        {d.items.map((p) => (
                          <ParcelCard key={p.id} parcel={p} />
                        ))}
                      </View>
                    )}
                  </QueryView>
                </>
              ) : (
                tr.status === 'active' && <Button label={t('proposeParcel')} icon="cube-outline" onPress={() => requireAuth(() => setChoosing(true), { needsVerifiedEmail: true })} />
              )}
              <ProposeModal visible={choosing} tripId={id} onClose={() => setChoosing(false)} trip={tr} />
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}

/** Colis de l'expéditeur compatibles avec le trajet (règle partagée isParcelCompatibleWithTrip). */
function ProposeModal({ visible, tripId, trip, onClose }: { visible: boolean; tripId: string; trip: NonNullable<ReturnType<typeof useTrip>['data']>; onClose: () => void }) {
  const { t } = useTranslation(['trip', 'common']);
  const mine = useQuery({
    queryKey: ['me', 'parcels', 'open-for-trip', tripId],
    enabled: visible,
    queryFn: async () => {
      const list = await api.get<Paginated<ParcelCardDto>>(`/me/parcels${qs({ status: 'open,negotiating', limit: 50 })}`);
      const details = await Promise.all(list.items.map((p) => api.get<ParcelDto>(`/parcels/${p.id}`)));
      return details.filter((p) =>
        isParcelCompatibleWithTrip(
          { ...p, desiredDate: p.desiredDate ? new Date(p.desiredDate) : null },
          { ...trip, departureAt: new Date(trip.departureAt), vehicle: { type: trip.vehicle.type } },
        ),
      );
    },
  });
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t('chooseParcel')} onBack={onClose} />
        <View style={{ padding: space(5), gap: space(3), flex: 1 }}>
          <QueryView query={mine} isEmpty={(d) => d.length === 0} empty={{ icon: 'cube-outline', title: t('noCompatibleParcel') }}>
            {(list) => (
              <View style={{ gap: space(3) }}>
                {list.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={async () => {
                      try {
                        await api.post(`/trips/${tripId}/requests`, { parcelId: p.id });
                        Alert.alert(t('requestSent'));
                        onClose();
                      } catch (err) {
                        Alert.alert(errorMessage(t, err));
                      }
                    }}
                  >
                    <View pointerEvents="none">
                      <ParcelCard parcel={p} />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </QueryView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
