// Inscription, écran 1 : identité, contact et mot de passe.

import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { registerAccountSchema, type RegisterAccountInput } from '@ucolis/shared';
import { AuthHeader } from '@/components/AuthHeader';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField, type TextFieldProps } from '@/components/TextField';
import { useRegisterDraft } from '@/session/registerDraft';
import { colors } from '@/theme';

type FieldName = keyof RegisterAccountInput;

const FIELDS: { name: FieldName; label: string; props: Partial<TextFieldProps> }[] = [
  {
    name: 'firstName',
    label: 'firstName',
    props: { autoComplete: 'given-name', textContentType: 'givenName' },
  },
  {
    name: 'lastName',
    label: 'lastName',
    props: { autoComplete: 'family-name', textContentType: 'familyName' },
  },
  {
    name: 'email',
    label: 'email',
    props: { keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email' },
  },
  { name: 'phone', label: 'phone', props: { keyboardType: 'phone-pad', autoComplete: 'tel' } },
  { name: 'password', label: 'password', props: { password: true, autoComplete: 'new-password' } },
  {
    name: 'passwordConfirm',
    label: 'passwordConfirm',
    props: { password: true, autoComplete: 'new-password' },
  },
];

export default function Register() {
  const { t } = useTranslation(['auth', 'common']);
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const draft = useRegisterDraft();
  const { control, handleSubmit } = useForm<RegisterAccountInput>({
    resolver: zodResolver(registerAccountSchema),
    defaultValues: draft.account ?? {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      passwordConfirm: '',
    },
  });

  const onNext = handleSubmit((values) => {
    draft.setAccount(values);
    router.push({ pathname: '/register-details', params: returnTo ? { returnTo } : {} });
  });

  return (
    <Screen scroll background={colors.surface} edges={['top', 'bottom']}>
      <AuthHeader title={t('registerTitle')} subtitle={t('registerSubtitle')} step="1 / 2" />
      {FIELDS.map(({ name, label, props }) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field, fieldState }) => (
            <TextField
              label={t(label)}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              hint={name === 'phone' ? t('phoneHint') : undefined}
              {...props}
            />
          )}
        />
      ))}
      <Button label={t('common:next')} onPress={onNext} />
    </Screen>
  );
}
