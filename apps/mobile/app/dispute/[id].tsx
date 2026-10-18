// Litige (F16), côté parties : motif, description, photos, réponse de l'autre partie (48 h), décision.

import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FileRef } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { useDispute } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { cdn } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { KeyValue, SectionCard } from '@/components/FormBits';
import { PhotoGrid } from '@/components/PhotoGrid';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { formatDateTime } from '@/format';
import { useSession } from '@/session/SessionContext';
import { colors, radii, space } from '@/theme';

function Photos({ photos }: { photos: FileRef[] }) {
  if (!photos.length) return null;
  return (
    <ScrollView horizontal contentContainerStyle={{ gap: space(2) }}>
      {photos.map((p) => (
        <Image key={p.publicId} source={{ uri: cdn(p.url, 400) }} style={styles.photo} contentFit="cover" />
      ))}
    </ScrollView>
  );
}

export default function DisputeDetail() {
  const { t } = useTranslation(['parcel', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const query = useDispute(id);
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<FileRef[]>([]);
  const [pending, setPending] = useState(false);

  async function respond() {
    setPending(true);
    try {
      await api.post(`/disputes/${id}/response`, { text, photos });
      void qc.invalidateQueries({ queryKey: ['dispute', id] });
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('disputeTitle')} />} onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
      <QueryView query={query}>
        {(d) => {
          const canRespond = d.against === user?.id && !d.response && d.status !== 'resolved' && new Date(d.responseDeadline) > new Date();
          return (
            <View style={{ gap: space(4) }}>
              <AppText weight="bold" color={colors.primaryDark} onPress={() => router.push({ pathname: '/parcel/[id]', params: { id: d.parcelId } })} accessibilityRole="link">
                {d.parcelTitle}
              </AppText>
              <SectionCard>
                <KeyValue label={t('disputeReason')} value={t(`disputeReasons.${d.reason}`)} />
                <KeyValue label="" value={t(`disputeStatus.${d.status}`)} />
                <AppText size="sm">{d.description}</AppText>
                <Photos photos={d.photos} />
              </SectionCard>
              {d.response ? (
                <SectionCard title={t('disputeResponse')}>
                  <AppText size="xs" color={colors.textMuted}>
                    {formatDateTime(d.response.at)}
                  </AppText>
                  <AppText size="sm">{d.response.text}</AppText>
                  <Photos photos={d.response.photos} />
                </SectionCard>
              ) : (
                d.status !== 'resolved' && (
                  <AppText size="sm" color={colors.textMuted}>
                    {t('responseDeadline', { date: formatDateTime(d.responseDeadline) })}
                  </AppText>
                )
              )}
              {canRespond && (
                <SectionCard title={t('respond')}>
                  <TextField label={t('disputeResponse')} value={text} onChangeText={setText} multiline maxLength={2000} />
                  <PhotoGrid photos={photos} onChange={setPhotos} purpose="dispute_photo" />
                  <Button label={t('respond')} onPress={respond} loading={pending} disabled={text.trim().length < 3} />
                </SectionCard>
              )}
              {d.status === 'resolved' && (
                <SectionCard title={t('decision')}>
                  {d.outcome && <AppText weight="bold">{t(`disputeOutcome.${d.outcome}`)}</AppText>}
                  {d.decisionNote && <AppText size="sm">{d.decisionNote}</AppText>}
                </SectionCard>
              )}
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({ photo: { width: 120, height: 120, borderRadius: radii.input } });
