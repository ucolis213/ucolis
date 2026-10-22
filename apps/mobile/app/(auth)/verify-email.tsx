// Code à 6 chiffres envoyé par email ; renvoi possible après 60 s.

import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OTP_LENGTH, otpCodeSchema, type Me } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { AuthHeader } from '@/components/AuthHeader';
import { Button } from '@/components/Button';
import { CodeInput } from '@/components/CodeInput';
import { Screen } from '@/components/Screen';
import { useReturnTo } from '@/hooks/useReturnTo';
import { useSession } from '@/session/SessionContext';
import { colors } from '@/theme';

const RESEND_DELAY_S = 60;

export default function VerifyEmail() {
  const { t } = useTranslation(['auth', 'errors']);
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { finish } = useReturnTo();
  const { user, setUser, isGuest } = useSession();
  const email = emailParam ?? user?.email ?? '';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [wait, setWait] = useState(RESEND_DELAY_S);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function verify() {
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setPending(true);
    setError(undefined);
    try {
      const res = await api.post<{ user: Me }>('/auth/verify-email', { email, code });
      if (!isGuest) setUser(res.user);
      finish();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setWait(RESEND_DELAY_S);
    try {
      await api.post('/auth/resend-code', { email });
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  return (
    <Screen scroll background={colors.surface} edges={['top', 'bottom']}>
      <AuthHeader title={t('verifyTitle')} subtitle={t('verifyBody', { email })} />
      <CodeInput label={t('code')} length={OTP_LENGTH} value={code} onChange={setCode} error={error} autoFocus />
      <Button label={t('verify')} onPress={verify} loading={pending} />
      <AppText
        align="center"
        weight="semibold"
        color={wait > 0 ? colors.textMuted : colors.primaryDark}
        accessibilityRole="button"
        accessibilityState={{ disabled: wait > 0 }}
        onPress={wait > 0 ? undefined : resend}
      >
        {wait > 0 ? t('resendIn', { seconds: wait }) : t('resend')}
      </AppText>
      <Button label={t('verifyLater')} variant="ghost" onPress={finish} />
    </Screen>
  );
}
