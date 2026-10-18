// Noter l'autre partie (F15) : note globale, critères facultatifs, commentaire. Double aveugle.

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CARRIER_CRITERIA, SENDER_CRITERIA } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { useReviewStatus } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/FormBits';
import { QueryView } from '@/components/QueryView';
import { RatingStars } from '@/components/RatingStars';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/States';
import { TextField } from '@/components/TextField';
import { UserRow } from '@/components/UserRow';
import { formatDate } from '@/format';
import { colors, space } from '@/theme';

export default function ReviewParcel() {
  const { t } = useTranslation(['parcel', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const status = useReviewStatus(id);
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [criteria, setCriteria] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      await api.post(`/parcels/${id}/reviews`, { rating, criteria, comment: comment.trim() || undefined });
      void qc.invalidateQueries({ queryKey: ['parcel', id] });
      Alert.alert(t('reviewThanks'), t('reviewBlind'));
      router.replace({ pathname: '/parcel/[id]', params: { id } });
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('reviewTitle')} />}>
      <QueryView query={status}>
        {(s) =>
          !s.canReview ? (
            <EmptyState icon="star-outline" title={s.alreadyReviewed ? t('reviewThanks') : t('common:unavailable')} body={s.alreadyReviewed ? t('reviewBlind') : undefined} />
          ) : (
            <View style={{ gap: space(4) }}>
              {s.target && <UserRow user={s.target} />}
              <AppText weight="bold">{s.direction === 'sender_to_carrier' ? t('reviewRateCarrier') : t('reviewRateSender')}</AppText>
              <RatingStars value={rating} onChange={setRating} size={36} />
              <SectionCard>
                {(s.direction === 'sender_to_carrier' ? CARRIER_CRITERIA : SENDER_CRITERIA).map((c) => (
                  <View key={c} style={{ gap: space(1) }}>
                    <AppText size="sm">{t(`criteria.${c}`)}</AppText>
                    <RatingStars value={criteria[c] ?? 0} onChange={(v) => setCriteria((cur) => ({ ...cur, [c]: v }))} size={22} />
                  </View>
                ))}
              </SectionCard>
              <TextField label={t('reviewComment')} value={comment} onChangeText={setComment} multiline maxLength={500} />
              <AppText size="xs" color={colors.textMuted}>
                {t('reviewBlind')} {s.deadline ? `(${formatDate(s.deadline)})` : ''}
              </AppText>
              <Button label={t('common:send')} onPress={submit} loading={pending} disabled={rating === 0} />
            </View>
          )
        }
      </QueryView>
    </Screen>
  );
}
