import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { backIcon, colors, MIN_TOUCH, space } from '../theme';
import { AppText } from './AppText';

/** En-tête des écrans empilés : retour, titre (ou contenu libre à sa place), action facultative à droite. */
export function ScreenHeader({
  title,
  titleContent,
  right,
  onBack,
}: {
  title: string;
  titleContent?: ReactNode;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/home')))}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel={t('back')}
      >
        <Ionicons name={backIcon()} size={24} color={colors.navy} />
      </Pressable>
      {titleContent ? (
        <View style={styles.title}>{titleContent}</View>
      ) : (
        <AppText size="lg" weight="bold" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
      )}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(2),
    paddingVertical: space(1),
    gap: space(1),
    backgroundColor: colors.background,
  },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  right: { minWidth: MIN_TOUCH, alignItems: 'flex-end', paddingEnd: space(2) },
});
