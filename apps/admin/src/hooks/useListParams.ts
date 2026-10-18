// Filtres et page d'une liste gardés dans l'URL : partageables et conservés au retour arrière.

import { useSearchParams } from 'react-router';
import { qs } from '../api/client';

export function useListParams<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const set = (patch: Partial<Record<K, string>>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch) as [K, string | undefined][]) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    setParams(next, { replace: true });
  };
  const setPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
  };
  return { values, page, set, setPage, query: (extra: Record<string, unknown> = {}) => qs({ ...values, page, limit: 20, ...extra }) };
}
