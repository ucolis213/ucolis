// Mot de passe oublié : la réponse de l'API est identique que l'email existe ou non.

import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emailSchema } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AuthHeader } from '@/components/AuthHeader';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors } from '@/theme';

export default function ForgotPassword() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function submit() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setPending(true);
    setError(undefined);
    try {
      await api.post('/auth/forgot-password', { email: parsed.data });
      router.replace({ pathname: '/reset-password', params: { email: parsed.data } });
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll background={colors.surface} edges={['top', 'bottom']}>
      <AuthHeader title={t('forgotPassword')} subtitle={t('forgotBody')} />
      <TextField
        label={t('email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={error}
      />
      <Button label={t('common:continue')} onPress={submit} loading={pending} />
    </Screen>
  );
}
