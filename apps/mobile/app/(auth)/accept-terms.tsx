// Nouvelle version des CGU : l'utilisateur doit l'accepter à sa prochaine ouverture de l'application.

import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Me } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { AuthHeader } from '@/components/AuthHeader';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useSession } from '@/session/SessionContext';
import { colors } from '@/theme';

export default function AcceptTerms() {
  const { t } = useTranslation(['auth', 'errors']);
  const config = useAppConfig();
  const { setUser, signOut } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!config.data) return;
    setPending(true);
    try {
      setUser(await api.post<Me>('/me/terms/accept', { version: config.data.termsVersion }));
      router.replace('/home');
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll background={colors.surface} edges={['top', 'bottom']}>
      <AuthHeader title={t('acceptTermsTitle')} subtitle={t('acceptTermsBody')} />
      <Button label={t('readTerms')} variant="outline" icon="document-text-outline" onPress={() => router.push('/help/content/terms')} />
      <Button label={t('readPrivacy')} variant="outline" icon="lock-closed-outline" onPress={() => router.push('/help/content/privacy')} />
      {error && <AppText color={colors.danger}>{error}</AppText>}
      <Button label={t('acceptAndContinue')} onPress={accept} loading={pending} />
      <Button label={t('profile:logout')} variant="ghost" onPress={() => signOut().then(() => router.replace('/home'))} />
    </Screen>
  );
}
