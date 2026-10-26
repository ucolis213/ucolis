// Mes avis (F15) : reçus (avec une réponse publique possible) et donnés.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ReviewDto } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { useMyReviews } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/FormBits';
import { PromptModal } from '@/components/PromptModal';
import { QueryView } from '@/components/QueryView';
import { RatingStars } from '@/components/RatingStars';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { formatDate } from '@/format';
import { colors, space } from '@/theme';

export default function MyReviews() {
  const { t } = useTranslation(['profile', 'parcel', 'common']);
  const query = useMyReviews();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'received' | 'given'>('received');
  const [replying, setReplying] = useState<ReviewDto | null>(null);
  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('myReviews')} />}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'received', label: t('reviewsReceived') },
          { value: 'given', label: t('reviewsGiven') },
        ]}
      />
      <QueryView query={query} isEmpty={(d) => d[tab].length === 0} empty={{ icon: 'star-outline', title: t('common:emptyTitle') }}>
        {(d) => (
          <View style={{ gap: space(3) }}>
            {d[tab].map((r) => (
              <SectionCard key={r.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                  <RatingStars value={r.rating} size={14} />
                  <AppText size="xs" color={colors.textMuted} style={{ flex: 1 }}>
                    {tab === 'received' ? r.author.displayName : ''} {r.publishedAt ? formatDate(r.publishedAt) : t('parcel:reviewBlind')}
                  </AppText>
                  {tab === 'received' && (
                    <Pressable
                      hitSlop={12}
                      onPress={() => router.push({ pathname: '/report', params: { type: 'review', id: r.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={t('parcel:reportReview')}
                    >
                      <Ionicons name="flag-outline" size={16} color={colors.textSubtle} />
                    </Pressable>
                  )}
                </View>
                {r.comment && <AppText size="sm">{r.comment}</AppText>}
                {Object.entries(r.criteria).map(([k, v]) => (
                  <AppText key={k} size="xs" color={colors.textMuted}>
                    {t(`parcel:criteria.${k}`)} : {v}/5
                  </AppText>
                ))}
                {r.reply ? (
                  <AppText size="sm" color={colors.textMuted}>
                    ↳ {r.reply.text}
                  </AppText>
                ) : (
                  tab === 'received' && r.publishedAt && <Button label={t('reply')} variant="ghost" fullWidth={false} onPress={() => setReplying(r)} />
                )}
              </SectionCard>
            ))}
          </View>
        )}
      </QueryView>
      <PromptModal
        visible={replying !== null}
        title={t('reply')}
        label={t('replyPlaceholder')}
        required
        inputProps={{ maxLength: 300, multiline: true }}
        onCancel={() => setReplying(null)}
        onConfirm={async (text) => {
          const r = replying!;
          setReplying(null);
          try {
            await api.post(`/reviews/${r.id}/reply`, { text });
            void qc.invalidateQueries({ queryKey: ['me', 'reviews'] });
          } catch (err) {
            Alert.alert(errorMessage(t, err));
          }
        }}
      />
    </Screen>
  );
}
