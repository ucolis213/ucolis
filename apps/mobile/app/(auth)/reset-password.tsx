import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { resetPasswordSchema } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { AuthHeader } from '@/components/AuthHeader';
import { Button } from '@/components/Button';
import { notify } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors } from '@/theme';

type FormValues = { email: string; code: string; password: string; passwordConfirm: string };

export default function ResetPassword() {
  const { t } = useTranslation(['auth', 'errors']);
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email, code: '', password: '', passwordConfirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.post('/auth/reset-password', values);
      notify(t('resetDone'));
      router.replace('/login');
    } catch (err) {
      setFormError(errorMessage(t, err));
    }
  });

  return (
    <Screen scroll background={colors.surface} edges={['top', 'bottom']}>
      <AuthHeader title={t('resetTitle')} subtitle={t('resetBody', { email })} />
      <AppText size="sm" color={colors.textMuted}>
        {t('codeSent')}
      </AppText>
      <Controller
        control={control}
        name="code"
        render={({ field, fieldState }) => (
          <TextField
            label={t('code')}
            value={field.value}
            onChangeText={(v) => field.onChange(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            error={fieldState.error?.message}
          />
        )}
      />
      {(['password', 'passwordConfirm'] as const).map((name) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field, fieldState }) => (
            <TextField
              label={t(name === 'password' ? 'newPassword' : 'passwordConfirm')}
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
              password
              autoComplete="new-password"
            />
          )}
        />
      ))}
      {formError && <AppText color={colors.danger}>{formError}</AppText>}
      <Button label={t('resetTitle')} onPress={onSubmit} loading={formState.isSubmitting} />
    </Screen>
  );
}
