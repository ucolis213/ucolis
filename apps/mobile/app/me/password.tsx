import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { changePasswordSchema } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { notify } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { colors } from '@/theme';

type FormValues = { currentPassword: string; password: string; passwordConfirm: string };
const FIELDS = [
  ['currentPassword', 'currentPassword', 'current-password'],
  ['password', 'newPassword', 'new-password'],
  ['passwordConfirm', 'auth:passwordConfirm', 'new-password'],
] as const;

export default function ChangePassword() {
  const { t } = useTranslation(['profile', 'auth', 'errors']);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', passwordConfirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.put('/me/password', values);
      notify(t('passwordChanged'));
      router.back();
    } catch (err) {
      setFormError(errorMessage(t, err));
    }
  });

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('changePassword')} />}>
        {FIELDS.map(([name, label, autoComplete]) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field, fieldState }) => (
              <TextField
                label={t(label)}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                password
                autoComplete={autoComplete}
              />
            )}
          />
        ))}
        {formError && <AppText color={colors.danger}>{formError}</AppText>}
        <Button label={t('common:save')} onPress={onSubmit} loading={formState.isSubmitting} />
    </Screen>
  );
}
