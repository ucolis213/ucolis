// Profil public (F3) : nom filtré (ou raison sociale), badges, ancienneté, statistiques de confiance,
// répartition des notes, avis, trajets actifs ; Contacter, Signaler, Bloquer.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
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
import { colors, radii, space } from '@/theme';

export default function PublicProfile() {
  const { t } = useTranslation(['profile', 'common', 'trip', 'parcel']);
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

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title="" />}>
      <QueryView query={user}>
        {(u) => (
          <View style={{ gap: space(4) }}>
            <View style={styles.identity}>
              <Avatar file={u.avatar} name={u.displayName} size={88} />
              <AppText size="xl" weight="bold" align="center">
                {u.displayName}
              </AppText>
              <View style={styles.row}>
                {u.badges.pro && <Badge kind="pro" />}
                {u.badges.identity && <Badge kind="identity" />}
              </View>
              <AppText size="sm" color={colors.textMuted}>
                {t('memberSince', { date: formatDate(u.memberSince, { day: undefined }) })} ·{' '}
                {wilayaName(u.wilayaCode)}
              </AppText>
              {u.rating.count > 0 ? (
                <RatingStars value={u.rating.average} count={u.rating.count} size={18} />
              ) : (
                <AppText size="sm" color={colors.textMuted}>
                  {t('noRating')}
                </AppText>
              )}
            </View>
            {u.bio ? <AppText>{u.bio}</AppText> : null}
            {!isMe && (
              <View style={styles.row}>
                {!blocked && (
                  <View style={styles.flex}>
                    <Button
                      label={t('contact')}
                      icon="chatbubble-outline"
                      onPress={() =>
                        requireAuth(
                          async () => {
                            try {
                              const conv = await api.post<ConversationDto>('/conversations', {
                                userId: id,
                              });
                              router.push({
                                pathname: '/conversation/[id]',
                                params: { id: conv.id },
                              });
                            } catch (err) {
                              Alert.alert(errorMessage(t, err));
                            }
                          },
                          { needsVerifiedEmail: true },
                        )
                      }
                    />
                  </View>
                )}
                <Button
                  label={t('parcel:actions.report')}
                  variant="outline"
                  fullWidth={false}
                  onPress={() =>
                    requireAuth(() =>
                      router.push({ pathname: '/report', params: { type: 'user', id } }),
                    )
                  }
                />
                <Button
                  label={blocked ? t('unblock') : t('block')}
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => requireAuth(() => toggleBlock(u.displayName))}
                />
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
            <SectionCard title={t('trustStats')}>
              <KeyValue label={t('parcelsSent')} value={String(u.stats.parcelsSent)} />
              <KeyValue label={t('parcelsCarried')} value={String(u.stats.parcelsCarried)} />
              <KeyValue
                label={t('successRate')}
                value={u.stats.successRate === null ? '-' : `${u.stats.successRate} %`}
              />
              <KeyValue label={t('withdrawals')} value={String(u.stats.withdrawals)} />
              {u.stats.medianReplyMinutes !== null && (
                <KeyValue
                  label=""
                  value={t('medianReply', { minutes: u.stats.medianReplyMinutes })}
                />
              )}
            </SectionCard>
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
                      <AppText size="xs" color={colors.textMuted}>
                        {r.author.displayName} · {r.publishedAt ? formatDate(r.publishedAt) : ''}
                      </AppText>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { alignItems: 'center', gap: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' },
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
