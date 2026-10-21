import { useCallback, useState } from 'react';

/**
 * Tirer pour rafraîchir : l'indicateur ne suit que le geste de l'utilisateur, pas les rechargements
 * en arrière-plan (isRefetching). Sur iOS, un RefreshControl passé à vrai puis à faux pendant que
 * l'écran est caché (discussion ouverte par-dessus la liste) reste bloqué à l'écran.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, onRefresh };
}
