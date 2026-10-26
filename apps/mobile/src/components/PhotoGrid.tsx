// Grille de photos d'un colis : 1 à 5, ajout (galerie ou caméra), suppression, réordonnancement ;
// la première sert de couverture. Chaque photo est compressée puis envoyée par upload signé.

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FileRef, UploadPurpose } from '@ucolis/shared';
import { compressImage, uploadFile } from '../api/upload';
import { colors, radii, space } from '../theme';
import { AppText } from './AppText';
import { cdn } from './Avatar';
import { askSource, pickImages } from './PhotoPicker';

export function PhotoGrid({
  photos,
  onChange,
  max = 5,
  purpose = 'parcel_photo',
}: {
  photos: FileRef[];
  onChange: (p: FileRef[]) => void;
  max?: number;
  purpose?: UploadPurpose;
}) {
  const { t } = useTranslation(['parcel', 'common']);
  const [progress, setProgress] = useState<number | null>(null);

  async function add() {
    const source = await askSource();
    if (!source) return;
    const assets = await pickImages(source, max - photos.length);
    let next = [...photos];
    for (const asset of assets) {
      setProgress(0);
      try {
        const uri = await compressImage(asset.uri, asset.width, asset.height);
        next = [...next, await uploadFile(purpose, { uri }, setProgress)];
        onChange(next);
      } finally {
        setProgress(null);
      }
    }
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...photos];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <View style={styles.grid}>
      {photos.map((p, i) => (
        <View key={p.publicId} style={styles.cell}>
          <Image source={{ uri: cdn(p.url, 300) }} style={styles.image} contentFit="cover" />
          {i === 0 && (
            <View style={styles.cover}>
              <AppText size="xs" weight="semibold" color="#FFFFFF">
                {t('cover')}
              </AppText>
            </View>
          )}
          <View style={styles.tools}>
            {i > 0 && (
              <Pressable onPress={() => move(i, -1)} style={styles.tool} accessibilityRole="button" accessibilityLabel={I18nManager.isRTL ? '→' : '←'}>
                <Ionicons name={I18nManager.isRTL ? 'arrow-forward' : 'arrow-back'} size={14} color="#FFFFFF" />
              </Pressable>
            )}
            <Pressable onPress={() => onChange(photos.filter((_, k) => k !== i))} style={styles.tool} accessibilityRole="button" accessibilityLabel={t('common:delete')}>
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ))}
      {photos.length < max && (
        <Pressable style={[styles.cell, styles.add]} onPress={add} disabled={progress !== null} accessibilityRole="button" accessibilityLabel={t('addPhoto')}>
          <Ionicons name="camera-outline" size={28} color={colors.primary} />
          <AppText size="xs" weight="medium" color={colors.primaryDark}>
            {progress !== null ? t('common:uploading', { percent: Math.round(progress * 100) }) : t('addPhoto')}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  cell: { width: 100, height: 100, borderRadius: radii.input, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  cover: { position: 'absolute', bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(28,28,46,0.6)', alignItems: 'center', paddingVertical: 2 },
  tools: { position: 'absolute', top: 4, end: 4, flexDirection: 'row', gap: 4 },
  tool: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(28,28,46,0.7)', alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: space(1), backgroundColor: colors.primarySoft },
});
