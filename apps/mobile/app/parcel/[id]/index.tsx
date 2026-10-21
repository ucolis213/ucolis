// Détail d'un colis (F7) : photos, carte, caractéristiques, expéditeur, et barre d'actions
// contextuelle calculée par shared/stateMachines (rôle de celui qui regarde × statut).

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  parcelActionsFor,
  type ConversationDto,
  type FileRef,
  type ParcelAction,
  type ParcelDto,
  type ParcelViewer,
} from '@ucolis/shared';
import { ApiError, api, errorMessage } from '@/api/client';
import { useParcel } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { cdn } from '@/components/Avatar';
import { Badge, StatusBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { confirm } from '@/components/ConfirmDialog';
import { KeyValue, SectionCard } from '@/components/FormBits';
import { PhotoViewer } from '@/components/PhotoViewer';
import { PromptModal } from '@/components/PromptModal';
import { LoadingSkeleton } from '@/components/QueryView';
import { RouteMap } from '@/components/RouteMap';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState } from '@/components/States';
import { StatusTimeline } from '@/components/StatusTimeline';
import { UserRow } from '@/components/UserRow';
import { distance, formatDate, formatDateTime, placeLabel, price, weight } from '@/format';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useSession } from '@/session/SessionContext';
import { draftFromParcel } from '@/state/draftFromParcel';
import { draftEntryRoute, useParcelDraft } from '@/state/parcelDraft';
import { colors, radii, space } from '@/theme';
import { stopTracking } from '@/tracking/location';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

/** Actions mises en avant en bouton principal ; les autres vont dans la liste secondaire. */
const PRIMARY: ParcelAction[] = [
  'login_to_offer',
  'accept_asking_price',
  'view_offers',
  'view_my_offer',
  'answer_counter',
  'start_delivery',
  'track',
  'enter_delivery_code',
  'confirm_delivery',
  'rate',
];
const DANGER: ParcelAction[] = ['cancel_listing', 'cancel_delivery', 'withdraw_assignment', 'withdraw_offer', 'open_dispute'];

const ICONS: Partial<Record<ParcelAction, keyof typeof Ionicons.glyphMap>> = {
  make_offer: 'pricetag-outline',
  ask_question: 'help-circle-outline',
  favorite: 'heart-outline',
  report: 'flag-outline',
  message: 'chatbubble-outline',
  edit: 'create-outline',
  share: 'share-social-outline',
  call: 'call-outline',
  view_delivery_code: 'key-outline',
  declare_delivery: 'checkmark-done-outline',
  open_dispute: 'alert-circle-outline',
  cancel_listing: 'close-circle-outline',
  cancel_delivery: 'close-circle-outline',
  withdraw_assignment: 'exit-outline',
  withdraw_offer: 'remove-circle-outline',
};

const WIDTH = Dimensions.get('window').width;

export default function ParcelDetail() {
  const { t } = useTranslation(['parcel', 'common', 'offer', 'errors']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useParcel(id);
  const pull = usePullToRefresh(query.refetch);
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();
  const { user } = useSession();
  const startDraft = useParcelDraft((s) => s.start);
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const [photoViewer, setPhotoViewer] = useState<{ photos: FileRef[]; index: number } | null>(null);
  const p = query.data;

  // Le partage GPS s'arrête dès que le colis quitte in_transit.
  useEffect(() => {
    if (p && p.viewer.role === 'assigned_carrier' && p.status !== 'in_transit') void stopTracking(p.id);
  }, [p]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['parcel', id] });
    void qc.invalidateQueries({ queryKey: ['me'] });
  };

  if (query.isPending) {
    return (
      <Screen edges={['top']} header={<ScreenHeader title="" />}>
        <LoadingSkeleton rows={4} height={120} />
      </Screen>
    );
  }
  if (query.isError || !p) {
    const unavailable = query.error instanceof ApiError && query.error.code === 'PARCEL_UNAVAILABLE';
    return (
      <Screen edges={['top']} header={<ScreenHeader title="" />}>
        {unavailable ? (
          <EmptyState icon="cube-outline" title={t('common:unavailableListing')} actionLabel={t('common:tabs.listings')} onAction={() => router.replace('/listings')} />
        ) : (
          <ErrorState message={errorMessage(t, query.error)} onRetry={() => query.refetch()} />
        )}
      </Screen>
    );
  }

  const viewer = p.viewer.role as ParcelViewer;
  // Sans poids : annonce publiée en mode rapide.
  const quick = p.weightKg === null;
  const actions = parcelActionsFor(viewer, p.status, {
    hasCounterOffer: p.viewer.myOffer?.status === 'countered',
    hasReviewed: p.viewer.hasReviewed,
  }).filter((a) => !(a === 'call' && !p.viewer.counterpartPhone));
  const isProSender = viewer === 'sender' && user?.accountType === 'professional';

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      refresh();
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    }
  };

  async function openConversation() {
    if (p!.viewer.conversationId) return router.push({ pathname: '/conversation/[id]', params: { id: p!.viewer.conversationId } });
    const conv = await api.post<ConversationDto>('/conversations', { userId: p!.sender.id, parcelId: p!.id });
    router.push({ pathname: '/conversation/[id]', params: { id: conv.id } });
  }

  function needCarrier(action: () => void) {
    requireAuth(() => {
      if (user && user.carrierVerification.status !== 'approved') {
        Alert.alert(t('offer:needVerification'), undefined, [
          { text: t('common:cancel'), style: 'cancel' },
          { text: t('common:continue'), onPress: () => router.push('/me/carrier-verification') },
        ]);
        return;
      }
      action();
    }, { needsVerifiedEmail: true });
  }

  async function onAction(a: ParcelAction) {
    switch (a) {
      case 'login_to_offer':
        return router.push({ pathname: '/login', params: { returnTo: `/parcel/${p!.id}` } });
      case 'accept_asking_price':
        return needCarrier(() => router.push({ pathname: '/parcel/[id]/make-offer', params: { id: p!.id, asking: '1' } }));
      case 'make_offer':
        return needCarrier(() => router.push({ pathname: '/parcel/[id]/make-offer', params: { id: p!.id } }));
      case 'ask_question':
      case 'message':
        return requireAuth(() => run(openConversation), { needsVerifiedEmail: true });
      case 'favorite':
        return requireAuth(() => run(() => (p!.isFavorite ? api.delete(`/me/favorites/${p!.id}`) : api.put(`/me/favorites/${p!.id}`))));
      case 'report':
        return requireAuth(() => router.push({ pathname: '/report', params: { type: 'parcel', id: p!.id } }));
      case 'view_my_offer':
      case 'answer_counter':
        return p!.viewer.myOffer && router.push({ pathname: '/offer/[id]', params: { id: p!.viewer.myOffer.id } });
      case 'withdraw_offer':
        if (p!.viewer.myOffer && (await confirm({ title: t('offer:withdrawConfirm'), destructive: true }))) {
          await run(() => api.post(`/offers/${p!.viewer.myOffer!.id}/withdraw`));
        }
        return;
      case 'view_offers':
        return router.push({ pathname: '/parcel/[id]/offers', params: { id: p!.id } });
      case 'edit':
        startDraft(draftFromParcel(p!), p!.id);
        return router.push(draftEntryRoute(p!.weightKg === null ? 'quick' : 'full'));
      case 'cancel_listing':
      case 'cancel_delivery':
        return setCancelPrompt(true);
      case 'share':
        return Share.share({ message: t('shareListing', { url: `ucolis://parcel/${p!.id}` }) });
      case 'call':
        return p!.viewer.counterpartPhone && Linking.openURL(`tel:${p!.viewer.counterpartPhone}`);
      case 'view_delivery_code':
      case 'enter_delivery_code':
        return router.push({ pathname: '/parcel/[id]/delivery-code', params: { id: p!.id } });
      case 'start_delivery':
        return router.push({ pathname: '/parcel/[id]/start', params: { id: p!.id } });
      case 'withdraw_assignment':
        if (await confirm({ title: t('actions.withdraw_assignment'), message: t('confirmWithdraw'), destructive: true })) {
          await run(() => api.post(`/parcels/${p!.id}/withdraw`));
        }
        return;
      case 'track':
        return router.push({ pathname: '/parcel/[id]/tracking', params: { id: p!.id } });
      case 'open_dispute':
        return router.push({ pathname: '/parcel/[id]/dispute', params: { id: p!.id } });
      case 'declare_delivery':
        return router.push({ pathname: '/parcel/[id]/declare', params: { id: p!.id } });
      case 'confirm_delivery':
        if (await confirm({ title: t('actions.confirm_delivery'), message: t('confirmDelivery') })) {
          await run(() => api.post(`/parcels/${p!.id}/confirm-delivery`));
        }
        return;
      case 'rate':
        return router.push({ pathname: '/parcel/[id]/review', params: { id: p!.id } });
    }
  }

  const primary = actions.filter((a) => PRIMARY.includes(a));
  const secondary = actions.filter((a) => !PRIMARY.includes(a));

  return (
    <Screen
      scroll
      padded={false}
      edges={['top', 'bottom']}
      {...pull}
      header={
        <ScreenHeader
          title={t('reference', { reference: p.reference })}
          right={
            viewer !== 'guest' && viewer !== 'sender' ? (
              <Pressable hitSlop={10} onPress={() => onAction('favorite')} accessibilityRole="button" accessibilityLabel={t('actions.favorite')}>
                <Ionicons name={p.isFavorite ? 'heart' : 'heart-outline'} size={24} color={p.isFavorite ? colors.danger : colors.navy} />
              </Pressable>
            ) : undefined
          }
        />
      }
      footer={
        primary.length || secondary.length ? (
          <View style={styles.footer}>
            {primary.map((a) => (
              <Button key={a} label={t(`actions.${a}`)} onPress={() => onAction(a)} />
            ))}
            {secondary.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.secondary}>
                {secondary.map((a) => (
                  <Pressable key={a} onPress={() => onAction(a)} style={styles.secondaryBtn} accessibilityRole="button" accessibilityLabel={t(`actions.${a}`)}>
                    <Ionicons name={ICONS[a] ?? 'ellipsis-horizontal'} size={20} color={DANGER.includes(a) ? colors.danger : colors.navy} />
                    <AppText size="xs" weight="medium" color={DANGER.includes(a) ? colors.danger : colors.navy}>
                      {t(`actions.${a}`)}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : undefined
      }
    >
      {p.photos.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {p.photos.map((ph, i) => (
            <Pressable
              key={ph.publicId}
              onPress={() => setPhotoViewer({ photos: p.photos, index: i })}
              accessibilityRole="imagebutton"
              accessibilityLabel={t('common:enlargePhoto')}
            >
              <Image source={{ uri: cdn(ph.url, 900) }} style={{ width: WIDTH, height: WIDTH * 0.66 }} contentFit="cover" accessibilityIgnoresInvertColors />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.body}>
        <View style={styles.badges}>
          <StatusBadge status={p.status} />
          {p.urgent && <Badge kind="urgent" />}
          {p.fragile && <Badge kind="fragile" />}
        </View>
        <AppText size="xl" weight="bold">
          {p.title}
        </AppText>
        <View style={styles.priceRow}>
          <AppText size="xxl" weight="bold" color={colors.primary}>
            {price(p.finalPrice ?? p.requestedPrice)}
          </AppText>
          <AppText size="sm" color={colors.textMuted}>
            {t('offersCount', { count: p.offersCount })}
          </AppText>
        </View>

        {p.viewer.openDisputeId && (
          <Button label={t('disputeTitle')} variant="outline" icon="alert-circle-outline" onPress={() => router.push({ pathname: '/dispute/[id]', params: { id: p.viewer.openDisputeId! } })} />
        )}
        {p.status === 'delivered_pending' && p.autoConfirmAt && (
          <AppText size="sm" color="#B7791F">
            {t('autoConfirmAt', { date: formatDateTime(p.autoConfirmAt) })}
          </AppText>
        )}

        <RouteMap from={p.pickup.location} to={p.dropoff.location} />
        <SectionCard>
          <KeyValue label={t('common:from')} value={placeLabel(p.pickup)} />
          {(viewer === 'sender' || viewer === 'assigned_carrier') && <KeyValue label="" value={p.pickup.address + (p.pickup.details ? ` · ${p.pickup.details}` : '')} />}
          <KeyValue label={t('common:to')} value={placeLabel(p.dropoff)} />
          {(viewer === 'sender' || viewer === 'assigned_carrier') && <KeyValue label="" value={p.dropoff.address + (p.dropoff.details ? ` · ${p.dropoff.details}` : '')} />}
          <KeyValue label={t('common:distance')} value={distance(p.distanceKm)} />
          <KeyValue
            label={t('desiredDate')}
            value={
              p.desiredDate
                ? `${formatDate(p.desiredDate)} · ${t(`common:timeSlots.${p.timeSlot}`)}${p.flexibleDates ? ' (±2)' : ''}`
                : t('flexibleDate')
            }
          />
          <KeyValue label={t('paymentArrangement')} value={quick ? t('notSpecified') : t(`common:payment.${p.paymentArrangement}`)} />
        </SectionCard>

        {/* Publication rapide : catégorie et véhicules posés par l'API, poids et dimensions non précisés. */}
        <SectionCard title={t('characteristics')}>
          {!quick && <KeyValue label={t('category')} value={t(`categories.${p.category}`)} />}
          <KeyValue label={t('weight')} value={p.weightKg === null ? t('notSpecified') : weight(p.weightKg)} />
          <KeyValue
            label={t('dimensions')}
            value={
              p.dimensionsCm
                ? `${p.dimensionsCm.length} × ${p.dimensionsCm.width} × ${p.dimensionsCm.height} cm · ${p.volumeM3} m³`
                : t('notSpecified')
            }
          />
          {!quick && <KeyValue label={t('vehicleTypesLabel')} value={p.vehicleTypes.map((v) => t(`vehicleTypes.${v}`)).join(', ')} />}
          {p.description ? <AppText size="sm">{p.description}</AppText> : null}
        </SectionCard>

        {p.recipient && (
          <SectionCard title={t('recipient')}>
            <KeyValue label={t('recipientName')} value={p.recipient.name} />
            <KeyValue label={t('recipientPhone')} value={p.recipient.phone} />
          </SectionCard>
        )}

        <SectionCard title={t('sender')}>
          <UserRow user={p.sender} plain />
        </SectionCard>
        {p.assignedCarrier && (
          <SectionCard title={t('carrier')}>
            <UserRow user={p.assignedCarrier} plain />
            {p.viewer.counterpartPhone && (
              <View style={styles.contact}>
                <Button label={t('common:call')} icon="call-outline" variant="outline" fullWidth={false} onPress={() => Linking.openURL(`tel:${p.viewer.counterpartPhone}`)} />
                <Button
                  label={t('common:whatsapp')}
                  icon="logo-whatsapp"
                  variant="outline"
                  fullWidth={false}
                  onPress={() => Linking.openURL(`https://wa.me/${p.viewer.counterpartPhone!.replace('+', '')}`)}
                />
              </View>
            )}
          </SectionCard>
        )}

        {p.deliveryProof && (
          <SectionCard title={t('proofPhoto')}>
            {p.deliveryProof.photo && (
              <Pressable
                onPress={() => setPhotoViewer({ photos: [p.deliveryProof!.photo!], index: 0 })}
                accessibilityRole="imagebutton"
                accessibilityLabel={t('common:enlargePhoto')}
              >
                <Image source={{ uri: cdn(p.deliveryProof.photo.url, 600) }} style={styles.proof} contentFit="cover" />
              </Pressable>
            )}
            {p.deliveryProof.note && <AppText size="sm">{p.deliveryProof.note}</AppText>}
          </SectionCard>
        )}

        {(viewer === 'sender' || viewer === 'assigned_carrier') && (
          <SectionCard title={t('history')}>
            <StatusTimeline history={p.statusHistory} />
          </SectionCard>
        )}

        {isProSender && (
          <Button
            label={t('duplicate')}
            variant="outline"
            icon="copy-outline"
            onPress={() =>
              run(async () => {
                const data = await api.post<Partial<ParcelDto>>(`/parcels/${p.id}/duplicate`);
                const draft = draftFromParcel(data, false);
                startDraft(draft);
                router.push(draftEntryRoute(draft.mode ?? 'full'));
              })
            }
          />
        )}
      </View>

      <PhotoViewer photos={photoViewer?.photos ?? []} index={photoViewer?.index ?? null} onClose={() => setPhotoViewer(null)} />

      <PromptModal
        visible={cancelPrompt}
        title={t(p.status === 'assigned' ? 'cancelDelivery' : 'cancelListing')}
        message={t('cancelConfirm')}
        label={t('cancelReason')}
        required={p.status === 'assigned'}
        destructive
        onCancel={() => setCancelPrompt(false)}
        onConfirm={async (reason) => {
          setCancelPrompt(false);
          await run(() => api.post(`/parcels/${p.id}/cancel`, { reason: reason || undefined }));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space(5), gap: space(4) },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  contact: { flexDirection: 'row', gap: space(2) },
  proof: { width: '100%', height: 200, borderRadius: radii.input },
  footer: { gap: space(2) },
  secondary: { gap: space(2) },
  secondaryBtn: { alignItems: 'center', gap: space(1), minWidth: 72, paddingVertical: space(1), paddingHorizontal: space(2) },
});
