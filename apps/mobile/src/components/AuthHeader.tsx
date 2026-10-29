import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { backIcon, colors, MIN_TOUCH, space } from '../theme';
import { AppText } from './AppText';

export function AuthHeader({
  title,
  subtitle,
  step,
}: {
  title: string;
  subtitle?: string;
  step?: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {router.canGoBack() && (
          <Pressable
            onPress={() => router.back()}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
          >
            <Ionicons name={backIcon()} size={22} color={colors.navy} />
          </Pressable>
        )}
        {step && (
          <AppText size="sm" color={colors.textMuted} style={styles.step}>
            {step}
          </AppText>
        )}
      </View>
      <AppText size="xxl" weight="bold">
        {title}
      </AppText>
      {subtitle && <AppText color={colors.textMuted}>{subtitle}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(2), marginBottom: space(3) },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: { marginStart: 'auto' },
});
