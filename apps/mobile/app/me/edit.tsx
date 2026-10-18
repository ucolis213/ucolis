import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { INTENTS, type Intent, type Me } from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { pickAndUpload } from '@/components/PhotoPicker';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { WilayaCommuneSelect } from '@/components/WilayaCommuneSelect';
import { useSession } from '@/session/SessionContext';
import { colors, space } from '@/theme';

export default function EditProfile() {
  const { t } = useTranslation(['profile', 'auth', 'common', 'errors']);
  const { user, setUser } = useSession();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    bio: user?.bio ?? '',
    intent: (user?.intent ?? 'both') as Intent,
    place: { wilayaCode: user?.wilayaCode ?? '', commune: user?.commune ?? '' },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  if (!user) return null;

  async function changeAvatar() {
    try {
      const avatar = await pickAndUpload('avatar', setProgress);
      if (avatar) setUser(await api.put<Me>('/me/avatar', { avatar }));
    } catch (err) {
      setFormError(errorMessage(t, err));
    } finally {
      setProgress(null);
    }
  }

  async function save() {
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      setUser(await api.patch<Me>('/me', form));
      router.back();
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('editProfile')} />}>
        <Pressable style={styles.avatar} onPress={changeAvatar} accessibilityRole="button" accessibilityLabel={t('auth:changePhoto')}>
          <Avatar file={user.avatar} name={`${user.firstName} ${user.lastName}`} size={88} />
          <AppText size="sm" weight="medium" color={colors.primaryDark}>
            {progress !== null ? t('common:uploading', { percent: Math.round(progress * 100) }) : t('auth:changePhoto')}
          </AppText>
        </Pressable>
        <TextField label={t('auth:firstName')} value={form.firstName} onChangeText={set('firstName')} error={errors.firstName} />
        <TextField label={t('auth:lastName')} value={form.lastName} onChangeText={set('lastName')} error={errors.lastName} />
        <TextField
          label={t('auth:phone')}
          value={form.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          error={errors.phone}
        />
        <WilayaCommuneSelect
          value={form.place}
          onChange={set('place')}
          errors={{ wilaya: errors['place.wilayaCode'], commune: errors['place.commune'] }}
        />
        <TextField
          label={t('bio')}
          value={form.bio}
          onChangeText={set('bio')}
          multiline
          maxLength={500}
          hint={`${form.bio.length} / 500`}
          style={{ minHeight: 96, textAlignVertical: 'top' }}
        />
        <AppText size="sm" weight="medium">
          {t('intentLabel')}
        </AppText>
        <Pressable style={styles.chips}>
          {INTENTS.map((i) => (
            <Chip key={i} label={t(`auth:intent.${i}`)} selected={form.intent === i} onPress={() => set('intent')(i)} />
          ))}
        </Pressable>
        {formError && <AppText color={colors.danger}>{formError}</AppText>}
        <Button label={t('common:save')} onPress={save} loading={pending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', gap: space(2) },
  chips: { flexDirection: 'row', gap: space(2), flexWrap: 'wrap' },
});
