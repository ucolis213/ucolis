// Jeton d'accès en mémoire uniquement ; jeton de rafraîchissement dans expo-secure-store.

import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'ucolis.refreshToken';

let accessToken: string | null = null;

export const tokens = {
  getAccess: () => accessToken,
  setAccess: (t: string | null) => {
    accessToken = t;
  },
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
  setRefresh: (t: string) => SecureStore.setItemAsync(REFRESH_KEY, t),
  async clear() {
    accessToken = null;
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
