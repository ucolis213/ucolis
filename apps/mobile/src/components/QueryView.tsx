// Les 4 états de chaque écran de liste : chargement (squelette), erreur (Réessayer), vide (message et action), contenu.

import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../api/client';
import { space } from '../theme';
import { EmptyState, ErrorState, Skeleton } from './States';

export function LoadingSkeleton({ rows = 3, height = 96 }: { rows?: number; height?: number }) {
  return (
    <View style={{ gap: space(3) }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </View>
  );
}

export function QueryView<T>({
  query,
  isEmpty,
  empty,
  children,
  skeletonRows,
}: {
  query: Pick<UseQueryResult<T>, 'isPending' | 'isError' | 'error'> & { data: T | undefined; refetch: () => unknown };
  isEmpty?: (data: T) => boolean;
  empty?: { icon?: Parameters<typeof EmptyState>[0]['icon']; title: string; body?: string; actionLabel?: string; onAction?: () => void };
  children: (data: T) => ReactNode;
  skeletonRows?: number;
}) {
  const { t } = useTranslation();
  if (query.isPending) return <LoadingSkeleton rows={skeletonRows} />;
  if (query.isError || query.data === undefined) {
    return <ErrorState message={errorMessage(t, query.error)} onRetry={() => query.refetch()} />;
  }
  if (isEmpty?.(query.data)) return <EmptyState {...(empty ?? { title: t('emptyTitle') })} />;
  return <>{children(query.data)}</>;
}
