// Inscription, écran 2 : wilaya, commune, intent, photo facultative, CGU. Aucun choix particulier/pro ici.

import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_SETTINGS,
  INTENTS,
  registerProfileSchema,
  type AuthResponse,
  type FileRef,
  type RegisterProfileInput,
} from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '@/api/client';
import { uploadFile, compressImage } from '@/api/upload';
import { AppText } from '@/components/AppText';
import { AuthHeader } from '@/components/AuthHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { askSource, pickImages } from '@/components/PhotoPicker';
import { Screen } from '@/components/Screen';
import { WilayaCommuneSelect } from '@/components/WilayaCommuneSelect';
import { deviceInfo } from '@/device';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useReturnTo } from '@/hooks/useReturnTo';
import { useRegisterDraft } from '@/session/registerDraft';
import { useSession } from '@/session/SessionContext';
import { colors, MIN_TOUCH, radii, space } from '@/theme';

export default function RegisterDetails() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const { returnTo } = useReturnTo();
  const draft = useRegisterDraft();
  const { signIn } = useSession();
  const config = useAppConfig();
  const [formError, setFormError] = useState<string | null>(null);
  const [showBusiness, setShowBusiness] = useState(false);
  // La photo est choisie maintenant mais envoyée après la création du compte (upload signé authentifié).
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const { control, handleSubmit, setValue, formState } = useForm<RegisterProfileInput>({
    resolver: zodResolver(registerProfileSchema),
    defaultValues: {
      place: { wilayaCode: '', commune: '' },
      intent: 'both',
      acceptTerms: false as unknown as true,
      termsVersion: config.data?.termsVersion ?? DEFAULT_SETTINGS.termsVersion,
    },
  });
  const place = useWatch({ control, name: 'place' });
  const account = draft.account;
  const fullName = useMemo(() => `${account?.firstName ?? ''} ${account?.lastName ?? ''}`, [account]);

  if (!account) return <Redirect href="/register" />;

  async function choosePhoto() {
    const source = await askSource();
    if (!source) return;
    const [asset] = await pickImages(source, 1);
    if (asset) setPhotoUri(await compressImage(asset.uri, asset.width, asset.height));
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await api.post<AuthResponse>('/auth/register', {
        ...account,
        ...values,
        ...(await deviceInfo()),
      });
      await signIn(res);
      if (photoUri) {
        try {
          const avatar: FileRef = await uploadFile('avatar', { uri: photoUri });
          await api.put('/me/avatar', { avatar });
        } catch {
          // La photo est facultative : un échec ne bloque pas l'inscription.
        }
      }
      draft.clear();
      router.replace({
        pathname: '/verify-email',
        params: { email: res.user.email, ...(returnTo ? { returnTo } : {}) },
      });
    } catch (err) {
      const fields = fieldErrors(err);
      setFormError(Object.keys(fields).length ? t('errors:VALIDATION_ERROR') : errorMessage(t, err));
    }
  });

  return (
    <Screen scroll background={colors.surface} edges={['top', 'bottom']}>
      <AuthHeader title={t('registerTitle')} step="2 / 2" />

      <Pressable style={styles.photo} onPress={choosePhoto} accessibilityRole="button" accessibilityLabel={t('addPhoto')}>
        <Avatar file={photoUri ? { url: photoUri, publicId: '', kind: 'image' } : null} name={fullName} size={72} />
        <AppText size="sm" weight="medium" color={colors.primaryDark}>
          {photoUri ? t('changePhoto') : t('addPhoto')}
        </AppText>
      </Pressable>

      <Controller
        control={control}
        name="place"
        render={({ fieldState }) => (
          <WilayaCommuneSelect
            value={place}
            onChange={(v) => setValue('place', v, { shouldValidate: formState.isSubmitted })}
            errors={{
              wilaya: (fieldState.error as { wilayaCode?: { message?: string } } | undefined)?.wilayaCode?.message,
              commune:
                (fieldState.error as { commune?: { message?: string } } | undefined)?.commune?.message ??
                fieldState.error?.message,
            }}
          />
        )}
      />

      <AppText size="sm" weight="medium">
        {t('intentTitle')}
      </AppText>
      <Controller
        control={control}
        name="intent"
        render={({ field }) => (
          <View style={styles.chips}>
            {INTENTS.map((i) => (
              <Chip key={i} label={t(`intent.${i}`)} selected={field.value === i} onPress={() => field.onChange(i)} />
            ))}
          </View>
        )}
      />

      <Controller
        control={control}
        name="acceptTerms"
        render={({ field, fieldState }) => (
          <View style={styles.gap}>
            <Pressable
              style={styles.checkRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!field.value }}
              onPress={() => field.onChange(!field.value)}
            >
              <View style={[styles.box, field.value && styles.boxOn]}>
                {field.value && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </View>
              <AppText size="sm" style={styles.flex}>
                {t('acceptTerms')}
              </AppText>
            </Pressable>
            <View style={styles.links}>
              <AppText size="xs" color={colors.primaryDark} accessibilityRole="link" onPress={() => router.push('/help/content/terms')}>
                {t('readTerms')}
              </AppText>
              <AppText size="xs" color={colors.primaryDark} accessibilityRole="link" onPress={() => router.push('/help/content/privacy')}>
                {t('readPrivacy')}
              </AppText>
            </View>
            {fieldState.error && (
              <AppText size="xs" color={colors.danger}>
                {t(`errors:${fieldState.error.message}`)}
              </AppText>
            )}
          </View>
        )}
      />

      <Pressable onPress={() => setShowBusiness((s) => !s)} accessibilityRole="button">
        <AppText size="sm" weight="semibold" color={colors.primaryDark}>
          {t('businessLink')}
        </AppText>
      </Pressable>
      {showBusiness && (
        <View style={styles.info}>
          <Ionicons name="briefcase-outline" size={18} color={colors.navy} />
          <AppText size="sm" style={styles.flex}>
            {t('businessHint')}
          </AppText>
        </View>
      )}

      {formError && (
        <AppText size="sm" color={colors.danger} accessibilityLiveRegion="polite">
          {formError}
        </AppText>
      )}
      <Button label={t('signUp')} onPress={onSubmit} loading={formState.isSubmitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space(1.5) },
  photo: { alignItems: 'center', gap: space(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: MIN_TOUCH },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space(4), paddingStart: space(9) },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  info: {
    flexDirection: 'row',
    gap: space(2),
    padding: space(3),
    borderRadius: radii.card,
    backgroundColor: colors.background,
  },
});
