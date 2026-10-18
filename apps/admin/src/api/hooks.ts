// Requêtes et mutations du back-office.

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from './client';

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/** `paginated` : garde la page affichée pendant le chargement de la suivante (jamais pour une fiche). */
export function useAdminQuery<T>(key: QueryKey, path: string, opts: { paginated?: boolean } = {}) {
  return useQuery({ queryKey: key, queryFn: () => api.get<T>(path), placeholderData: opts.paginated ? keepPreviousData : undefined });
}

/** Mutation qui rafraîchit les listes concernées une fois l'action réussie. */
export function useAction<V, R = unknown>(fn: (v: V) => Promise<R>, invalidate: QueryKey[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(invalidate.map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}
