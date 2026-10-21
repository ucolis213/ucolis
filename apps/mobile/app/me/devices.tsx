import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SessionDto } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { confirm } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { formatDateTime } from '@/format';
import { colors, radii, shadow, space } from '@/theme';

export default function Devices() {
  const { t } = useTranslation(['profile', 'common']);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['me', 'sessions'],
    queryFn: () => api.get<{ items: SessionDto[] }>('/me/sessions'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/me/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'sessions'] }),
  });
  const revokeOthers = useMutation({
    mutationFn: () => api.delete('/me/sessions'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'sessions'] }),
  });

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('devices')} />}>
        {query.isPending ? (
          <>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </>
        ) : query.isError ? (
          <ErrorState message={errorMessage(t, query.error)} onRetry={() => query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState icon="phone-portrait-outline" title={t('common:emptyTitle')} />
        ) : (
          query.data.items.map((s) => (
            <View key={s.id} style={styles.card}>
              <Ionicons
                name={s.platform === 'ios' ? 'logo-apple' : 'logo-android'}
                size={28}
                color={colors.navy}
              />
              <View style={styles.flex}>
                <AppText weight="semibold">{s.deviceName ?? s.platform ?? '-'}</AppText>
                <AppText size="xs" color={s.current ? colors.primaryDark : colors.textMuted}>
                  {s.current ? t('thisDevice') : t('lastActive', { date: formatDateTime(s.lastActiveAt) })}
                </AppText>
              </View>
              {!s.current && (
                <Button
                  label={t('disconnect')}
                  variant="ghost"
                  fullWidth={false}
                  onPress={async () => {
                    if (await confirm({ title: t('disconnectConfirm'), destructive: true })) revoke.mutate(s.id);
                  }}
                />
              )}
            </View>
          ))
        )}
        {(query.data?.items.length ?? 0) > 1 && (
          <Button
            label={t('disconnectOthers')}
            variant="outline"
            loading={revokeOthers.isPending}
            onPress={async () => {
              if (await confirm({ title: t('disconnectOthers'), destructive: true })) revokeOthers.mutate();
            }}
          />
        )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadow,
  },
});
