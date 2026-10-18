// Écran « Connectez-vous » des onglets réservés (Publier, Messages, Profil) en mode invité.

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space } from '../theme';
import { Button } from './Button';
import { EmptyState } from './States';

export function GuestGate({ returnTo }: { returnTo: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <EmptyState icon="lock-closed-outline" title={t('guest.title')} body={t('guest.body')} />
      <View style={styles.actions}>
        <Button
          label={t('guest.login')}
          onPress={() => router.push({ pathname: '/login', params: { returnTo } })}
        />
        <Button
          label={t('guest.register')}
          variant="outline"
          onPress={() => router.push({ pathname: '/register', params: { returnTo } })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: space(5) },
  actions: { gap: space(3) },
});
