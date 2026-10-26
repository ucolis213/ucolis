// Profil public (F3) : nom filtré (ou raison sociale), badges, ancienneté, statistiques de confiance,
// répartition des notes, avis, trajets actifs. Contacter en action principale, seulement après une offre
// acceptée entre les deux ; Signaler (drapeau) et Bloquer (menu) dans l'en-tête.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ConversationDto, UserSummary } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { usePublicUser, useUserReviews, useUserTrips } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { confirm } from '@/components/ConfirmDialog';
import { KeyValue, SectionCard } from '@/components/FormBits';
import { QueryView } from '@/components/QueryView';
import { RatingStars } from '@/components/RatingStars';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TripCard } from '@/components/TripCard';
import { formatDate, wilayaName } from '@/format';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useSession } from '@/session/SessionContext';
import { colors, radii, shadow, space } from '@/theme';

export default function PublicProfile() {
  const { t } = useTranslation(['profile', 'common', 'trip', 'parcel', 'chat']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useSession();
  const user = usePublicUser(id);
  const reviews = useUserReviews(id);
  const trips = useUserTrips(id);
  const requireAuth = useRequireAuth();
  const qc = useQueryClient();
  const isMe = me?.id === id;
  // Même liste que l'écran « Utilisateurs bloqués » : Bloquer devient Débloquer.
  const blockedList = useQuery({
    queryKey: ['me', 'blocked'],
    queryFn: () => api.get<{ items: UserSummary[] }>('/me/blocked'),
    enabled: !!me && !isMe,
  });
  const blocked = !!blockedList.data?.items.some((b) => b.id === id);

  async function toggleBlock(name: string) {
    try {
      if (blocked) await api.delete(`/me/blocked/${id}`);
      else if (
        await confirm({
          title: t('block'),
          message: t('blockConfirm', { name }),
          destructive: true,
        })
      )
        await api.post(`/me/blocked/${id}`);
      else return;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['me', 'blocked'] }),
        qc.invalidateQueries({ queryKey: ['conversations'] }),
        qc.invalidateQueries({ queryKey: ['conversation'] }),
      ]);
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    }
  }

  const report = () =>
    requireAuth(() => router.push({ pathname: '/report', params: { type: 'user', id } }));

  /** Menu « Plus » de l'en-tête : bloquer ou débloquer. */
  function menu(name: string) {
    const label = blocked ? t('unblock') : t('block');
    const run = () => requireAuth(() => void toggleBlock(name));
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [label, t('common:cancel')],
          cancelButtonIndex: 1,
          destructiveButtonIndex: blocked ? undefined : 0,
        },
        (i) => {
          if (i === 0) run();
        },
      );
    } else {
      Alert.alert(name, undefined, [
        { text: t('common:cancel'), style: 'cancel' },
        { text: label, style: blocked ? 'default' : 'destructive', onPress: run },
      ]);
    }
  }

  const contact = () =>
    requireAuth(
      async () => {
        try {
          const conv = await api.post<ConversationDto>('/conversations', { userId: id });
          router.push({ pathname: '/conversation/[id]', params: { id: conv.id } });
        } catch (err) {
          Alert.alert(errorMessage(t, err));
        }
      },
      { needsVerifiedEmail: true },
    );

  const headerActions =
    !isMe && user.data ? (
      <View style={styles.headerActions}>
        <Pressable
          onPress={report}
          hitSlop={8}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel={t('parcel:actions.report')}
        >
          <Ionicons name="flag-outline" size={22} color={colors.navy} />
        </Pressable>
        <Pressable
          onPress={() => menu(user.data!.displayName)}
          hitSlop={8}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common:more')}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={colors.navy} />
        </Pressable>
      </View>
    ) : undefined;

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="" right={headerActions} />}
    >
      <QueryView query={user}>
        {(u) => (
          <View style={{ gap: space(4) }}>
            <View style={styles.card}>
              <Avatar file={u.avatar} name={u.displayName} size={88} />
              <AppText size="xl" weight="bold" align="center">
                {u.displayName}
              </AppText>
              {(u.badges.pro || u.badges.identity) && (
                <View style={styles.row}>
                  {u.badges.pro && <Badge kind="pro" />}
                  {u.badges.identity && <Badge kind="identity" />}
                </View>
              )}
              {u.rating.count > 0 ? (
                <RatingStars value={u.rating.average} count={u.rating.count} size={18} />
              ) : (
                <AppText size="sm" color={colors.textMuted}>
                  {t('noRating')}
                </AppText>
              )}
              <View style={styles.meta}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <AppText size="sm" color={colors.textMuted}>
                  {t('memberSince', { date: formatDate(u.memberSince, { day: undefined }) })}
                </AppText>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <AppText size="sm" color={colors.textMuted}>
                  {wilayaName(u.wilayaCode)}
                </AppText>
              </View>
              {u.bio ? (
                <AppText size="sm" align="center" style={styles.bio}>
                  {u.bio}
                </AppText>
              ) : null}
              {!isMe &&
                (blocked ? (
                  <View style={styles.fullWidth}>
                    <AppText size="sm" color={colors.textMuted} align="center">
                      {t('chat:blockedByMe', { name: u.displayName })}
                    </AppText>
                    <Button
                      label={t('unblock')}
                      variant="outline"
                      onPress={() => requireAuth(() => void toggleBlock(u.displayName))}
                    />
                  </View>
                ) : (
                  // Seulement après une offre acceptée entre nous (règle de l'API, F13).
                  u.canContact && (
                    <View style={styles.fullWidth}>
                      <Button label={t('contact')} icon="chatbubble-outline" onPress={contact} />
                    </View>
                  )
                ))}
            </View>

            <View style={styles.stats}>
              <Stat
                icon="cube-outline"
                value={String(u.stats.parcelsSent)}
                label={t('parcelsSent')}
              />
              <Stat
                icon="car-outline"
                value={String(u.stats.parcelsCarried)}
                label={t('parcelsCarried')}
              />
              <Stat
                icon="checkmark-circle-outline"
                value={u.stats.successRate === null ? '-' : `${u.stats.successRate} %`}
                label={t('successRate')}
              />
              <Stat
                icon="return-down-back-outline"
                value={String(u.stats.withdrawals)}
                label={t('withdrawals')}
              />
            </View>
            {u.stats.medianReplyMinutes !== null && (
              <View style={styles.meta}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <AppText size="sm" color={colors.textMuted}>
                  {t('medianReply', { minutes: u.stats.medianReplyMinutes })}
                </AppText>
              </View>
            )}

            {u.company && (
              <SectionCard title={t('company')}>
                <KeyValue label={t('companyName')} value={u.company.name} />
                {u.company.legalForm && (
                  <KeyValue label={t('legalForm')} value={t(`legalForms.${u.company.legalForm}`)} />
                )}
              </SectionCard>
            )}
            {u.rating.count > 0 && (
              <SectionCard title={t('myReviews')}>
                {[5, 4, 3, 2, 1].map((n) => {
                  const count = u.rating.distribution[n - 1] ?? 0;
                  return (
                    <View key={n} style={styles.distRow}>
                      <AppText size="xs" style={{ width: 16 }}>
                        {n}
                      </AppText>
                      <View style={styles.bar}>
                        <View
                          style={[styles.fill, { width: `${(count / u.rating.count) * 100}%` }]}
                        />
                      </View>
                      <AppText size="xs" color={colors.textMuted} style={{ width: 24 }}>
                        {count}
                      </AppText>
                    </View>
                  );
                })}
                {reviews.data?.items.map((r) => (
                  <View key={r.id} style={styles.review}>
                    <View style={styles.row}>
                      <RatingStars value={r.rating} size={12} />
                      <AppText size="xs" color={colors.textMuted} style={styles.flex}>
                        {r.author.displayName} · {r.publishedAt ? formatDate(r.publishedAt) : ''}
                      </AppText>
                      {r.author.id !== me?.id && (
                        <Pressable
                          hitSlop={12}
                          onPress={() =>
                            requireAuth(() =>
                              router.push({
                                pathname: '/report',
                                params: { type: 'review', id: r.id },
                              }),
                            )
                          }
                          accessibilityRole="button"
                          accessibilityLabel={t('parcel:reportReview')}
                        >
                          <Ionicons name="flag-outline" size={16} color={colors.textSubtle} />
                        </Pressable>
                      )}
                    </View>
                    {r.comment && <AppText size="sm">{r.comment}</AppText>}
                    {r.reply && (
                      <AppText size="sm" color={colors.textMuted}>
                        ↳ {r.reply.text}
                      </AppText>
                    )}
                  </View>
                ))}
              </SectionCard>
            )}
            {(trips.data?.items.length ?? 0) > 0 && (
              <View style={{ gap: space(3) }}>
                <AppText weight="bold">{t('activeTrips')}</AppText>
                {trips.data!.items.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </View>
            )}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

/** Tuile de statistique de confiance (deux par ligne). */
function Stat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <AppText size="lg" weight="bold">
        {value}
      </AppText>
      <AppText size="xs" color={colors.textMuted} numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    alignItems: 'center',
    gap: space(2),
    padding: space(5),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadow,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(1),
    flexWrap: 'wrap',
  },
  bio: { marginTop: space(1) },
  fullWidth: { alignSelf: 'stretch', gap: space(2), marginTop: space(2) },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  stat: {
    flexBasis: '45%',
    flexGrow: 1,
    gap: space(1),
    padding: space(4),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.warning },
  review: {
    gap: space(1),
    paddingTop: space(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderRadius: radii.input,
  },
});
