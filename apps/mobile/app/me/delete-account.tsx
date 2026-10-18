// Suppression de compte (F17) : mot de passe, délai de grâce de 14 jours, puis déconnexion.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { confirm, notify } from '@/components/ConfirmDialog';
import { SectionCard } from '@/components/FormBits';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { useSession } from '@/session/SessionContext';
import { colors } from '@/theme';

export default function DeleteAccount() {
  const { t } = useTranslation(['profile', 'auth', 'common']);
  const { signOut } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!password) return setError(t('errors:validation.required'));
    if (!(await confirm({ title: t('deleteTitle'), message: t('deleteConfirm'), destructive: true, confirmLabel: t('deleteAction') }))) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/me/deletion', { password });
      notify(t('deleteScheduled'));
      await signOut({ remote: true });
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('deleteTitle')} />}>
      <SectionCard>
        <AppText size="sm">{t('deleteBody')}</AppText>
      </SectionCard>
      <TextField label={t('auth:password')} value={password} onChangeText={setPassword} password autoComplete="current-password" />
      {error && <AppText color={colors.danger}>{error}</AppText>}
      <Button label={t('deleteAction')} variant="danger" onPress={submit} loading={busy} />
    </Screen>
  );
}
