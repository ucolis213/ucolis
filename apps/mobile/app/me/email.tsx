import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OTP_LENGTH, emailSchema, otpCodeSchema, type Me } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CodeInput } from '@/components/CodeInput';
import { notify } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { useSession } from '@/session/SessionContext';
import { colors } from '@/theme';

export default function ChangeEmail() {
  const { t } = useTranslation(['profile', 'auth', 'errors']);
  const { setUser } = useSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function request() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setPending(true);
    setError(undefined);
    try {
      await api.post('/me/email-change', { email: parsed.data });
      setSent(true);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  async function confirmCode() {
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setPending(true);
    try {
      setUser(await api.post<Me>('/me/email-change/confirm', { code }));
      notify(t('emailChanged'));
      router.back();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('changeEmail')} />}>
        <TextField
          label={t('newEmail')}
          value={email}
          onChangeText={setEmail}
          editable={!sent}
          keyboardType="email-address"
          autoCapitalize="none"
          error={sent ? undefined : error}
        />
        {sent ? (
          <>
            <AppText size="sm" color={colors.textMuted}>
              {t('emailCodeSent', { email })}
            </AppText>
            <CodeInput label={t('auth:code')} length={OTP_LENGTH} value={code} onChange={setCode} error={error} autoFocus />
            <Button label={t('confirmEmail')} onPress={confirmCode} loading={pending} />
          </>
        ) : (
          <Button label={t('common:continue')} onPress={request} loading={pending} />
        )}
    </Screen>
  );
}
