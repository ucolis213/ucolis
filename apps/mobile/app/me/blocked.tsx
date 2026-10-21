import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { UserSummary } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { UserRow } from '@/components/UserRow';

export default function Blocked() {
  const { t } = useTranslation(['profile', 'common']);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['me', 'blocked'],
    queryFn: () => api.get<{ items: UserSummary[] }>('/me/blocked'),
  });
  const unblock = useMutation({
    mutationFn: (id: string) => api.delete(`/me/blocked/${id}`),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['me', 'blocked'] }),
        qc.invalidateQueries({ queryKey: ['conversations'] }),
        qc.invalidateQueries({ queryKey: ['conversation'] }),
      ]),
  });

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('blockedUsers')} />}>
      {query.isPending ? (
        <Skeleton height={64} />
      ) : query.isError ? (
        <ErrorState message={errorMessage(t, query.error)} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon="ban-outline" title={t('noBlocked')} />
      ) : (
        query.data.items.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            right={
              <Button
                label={t('unblock')}
                variant="ghost"
                fullWidth={false}
                onPress={() => unblock.mutate(u.id)}
              />
            }
          />
        ))
      )}
    </Screen>
  );
}
