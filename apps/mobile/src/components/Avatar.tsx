import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { FileRef } from '@ucolis/shared';
import { colors } from '../theme';
import { AppText } from './AppText';

/** Image Cloudinary servie redimensionnée (w_, q_auto, f_auto). */
export const cdn = (url: string, width: number) =>
  url.includes('/upload/') ? url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto/`) : url;

export function Avatar({ file, name, size = 44 }: { file: FileRef | null | undefined; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (file?.url) {
    return (
      <Image
        source={{ uri: cdn(file.url, size * 3) }}
        style={style}
        contentFit="cover"
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  return (
    <View style={[styles.fallback, style]}>
      <AppText weight="bold" color={colors.primaryDark} style={{ fontSize: size * 0.38 }}>
        {initials}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
