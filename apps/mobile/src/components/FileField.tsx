// Pièce justificative : photo (caméra, galerie) ou PDF, envoyée en upload signé « authenticated ».

import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FileRef, UploadPurpose } from '@ucolis/shared';
import { errorMessage } from '../api/client';
import { compressImage, uploadFile } from '../api/upload';
import { colors, MIN_TOUCH, radii, space } from '../theme';
import { AppText } from './AppText';
import { pickImages } from './PhotoPicker';

export function FileField({
  label,
  value,
  onChange,
  purpose,
  error,
}: {
  label: string;
  value: FileRef | null;
  onChange: (f: FileRef | null) => void;
  purpose: UploadPurpose;
  error?: string;
}) {
  const { t } = useTranslation(['profile', 'common', 'errors']);
  const [progress, setProgress] = useState<number | null>(null);

  async function upload(file: { uri: string; mimeType?: string; name?: string }) {
    setProgress(0);
    try {
      onChange(await uploadFile(purpose, file, setProgress));
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    } finally {
      setProgress(null);
    }
  }

  function choose() {
    Alert.alert(label, t('pdfOrImage'), [
      {
        text: t('common:takePhoto'),
        onPress: async () => {
          const [a] = await pickImages('camera', 1);
          if (a) await upload({ uri: await compressImage(a.uri, a.width, a.height) });
        },
      },
      {
        text: t('common:chooseFromGallery'),
        onPress: async () => {
          const [a] = await pickImages('library', 1);
          if (a) await upload({ uri: await compressImage(a.uri, a.width, a.height) });
        },
      },
      {
        text: 'PDF',
        onPress: async () => {
          const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
          const doc = res.canceled ? null : res.assets[0];
          if (doc) await upload({ uri: doc.uri, mimeType: 'application/pdf', name: doc.name });
        },
      },
      { text: t('common:cancel'), style: 'cancel' },
    ]);
  }

  return (
    <View style={{ gap: space(1) }}>
      <Pressable
        style={[styles.row, !!error && { borderColor: colors.danger }, value && styles.done]}
        onPress={choose}
        disabled={progress !== null}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons
          name={value ? 'checkmark-circle' : value === null && progress !== null ? 'hourglass-outline' : 'document-attach-outline'}
          size={22}
          color={value ? colors.accentDark : colors.textMuted}
        />
        <View style={styles.flex}>
          <AppText size="sm" weight="medium">
            {label}
          </AppText>
          <AppText size="xs" color={colors.textMuted}>
            {progress !== null
              ? t('common:uploading', { percent: Math.round(progress * 100) })
              : value
                ? `${value.kind === 'pdf' ? 'PDF' : t('common:photos')} ✓`
                : t('pdfOrImage')}
          </AppText>
        </View>
        <AppText size="sm" weight="semibold" color={colors.primaryDark}>
          {value ? t('replaceDocument') : t('uploadDocument')}
        </AppText>
      </Pressable>
      {error && (
        <AppText size="xs" color={colors.danger}>
          {t(`errors:${error}`, { defaultValue: error })}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    minHeight: MIN_TOUCH + 12,
    padding: space(3),
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  done: { borderColor: colors.accentDark },
});
