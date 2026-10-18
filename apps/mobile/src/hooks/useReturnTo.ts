import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback } from 'react';

/** Après connexion : reprend l'action interrompue (returnTo), sinon revient à l'accueil. */
export function useReturnTo() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const finish = useCallback(() => {
    router.dismissAll?.();
    router.replace((returnTo || '/home') as Href);
  }, [returnTo]);
  return { returnTo, finish };
}
