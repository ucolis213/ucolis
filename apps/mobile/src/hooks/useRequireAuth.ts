// Garde des actions protégées : un invité est envoyé vers la feuille de connexion, et l'action reprend
// après connexion grâce au paramètre returnTo.

import { router, usePathname } from 'expo-router';
import { useCallback } from 'react';
import { useSession } from '../session/SessionContext';

export function useRequireAuth() {
  const { isGuest, user } = useSession();
  const pathname = usePathname();

  return useCallback(
    (action: () => void, opts: { returnTo?: string; needsVerifiedEmail?: boolean } = {}) => {
      if (isGuest) {
        router.push({ pathname: '/login', params: { returnTo: opts.returnTo ?? pathname } });
        return;
      }
      if (opts.needsVerifiedEmail && user && !user.emailVerified) {
        router.push({ pathname: '/verify-email', params: { email: user.email } });
        return;
      }
      action();
    },
    [isGuest, user, pathname],
  );
}
