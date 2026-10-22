import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { loginSchema, type AuthResponse } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { AuthHeader } from '@/components/AuthHeader';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { deviceInfo } from '@/device';
import { useReturnTo } from '@/hooks/useReturnTo';
import { useSession } from '@/session/SessionContext';
import { colors, space } from '@/theme';

const formSchema = loginSchema.pick({ email: true, password: true });
type FormValues = { email: string; password: string };

export default function Login() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const { returnTo, finish } = useReturnTo();
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await api.post<AuthResponse>('/auth/login', { ...values, ...(await deviceInfo()) });
      await signIn(res);
      finish();
    } catch (err) {
      setFormError(errorMessage(t, err));
    }
  });

  return (
    <Screen scroll background={colors.surface} edges={['top', 'bottom']}>
      <View style={styles.logo}>
        <Logo size={30} />
      </View>
      <AuthHeader title={t('loginTitle')} subtitle={t('loginSubtitle')} />

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={t('email')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label={t('password')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            password
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={onSubmit}
          />
        )}
      />

      <AppText
        size="sm"
        weight="medium"
        color={colors.primaryDark}
        align="right"
        accessibilityRole="link"
        onPress={() => router.push('/forgot-password')}
      >
        {t('forgotPassword')}
      </AppText>

      {formError && (
        <AppText size="sm" color={colors.danger} accessibilityLiveRegion="polite">
          {formError}
        </AppText>
      )}

      <Button label={t('loginTitle')} onPress={onSubmit} loading={formState.isSubmitting} />

      <View style={styles.footer}>
        <AppText size="sm" color={colors.textMuted}>
          {t('noAccount')}
        </AppText>
        <AppText
          size="sm"
          weight="semibold"
          color={colors.primaryDark}
          accessibilityRole="link"
          onPress={() => router.replace({ pathname: '/register', params: returnTo ? { returnTo } : {} })}
        >
          {t('signUp')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', marginVertical: space(4) },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: space(1.5), marginTop: space(2) },
});
