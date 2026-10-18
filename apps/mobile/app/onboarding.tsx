// 3 diapositives à la première ouverture, avec choix de la langue sur la première.

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LOCALES } from '@ucolis/shared';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { changeLanguage, currentLocale } from '@/i18n';
import { colors, space } from '@/theme';
import { ONBOARDING_KEY } from '@/storageKeys';

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; key: 1 | 2 | 3 }[] = [
  { icon: 'cube-outline', key: 1 },
  { icon: 'car-outline', key: 2 },
  { icon: 'shield-checkmark-outline', key: 3 },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const last = index === SLIDES.length - 1;

  async function finish(next: '/home' | '/login') {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    router.replace('/home');
    if (next === '/login') router.push('/login');
  }

  return (
    <Screen background={colors.surface} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Logo size={24} />
        {!last && (
          <AppText
            weight="medium"
            color={colors.textMuted}
            onPress={() => finish('/home')}
            accessibilityRole="button"
            suppressHighlighting
          >
            {t('next')} »
          </AppText>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.illustration}>
          <Ionicons name={slide.icon} size={96} color={colors.primary} />
        </View>
        <AppText size="xl" weight="bold" align="center">
          {t(`onboarding.slide${slide.key}Title`)}
        </AppText>
        <AppText color={colors.textMuted} align="center">
          {t(`onboarding.slide${slide.key}Body`)}
        </AppText>

        {index === 0 && (
          <View style={styles.languages}>
            <AppText size="sm" weight="medium" align="center">
              {t('chooseLanguage')}
            </AppText>
            <View style={styles.chips}>
              {LOCALES.map((l) => (
                <Chip
                  key={l}
                  label={t(`languages.${l}`)}
                  selected={currentLocale() === l}
                  onPress={() => changeLanguage(l)}
                />
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.dots} accessibilityLabel={`${index + 1} / ${SLIDES.length}`}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {last ? (
        <View style={styles.actions}>
          <Button label={t('start')} onPress={() => finish('/home')} />
          <Button label={t('guest.login')} variant="outline" onPress={() => finish('/login')} />
        </View>
      ) : (
        <Button label={t('next')} onPress={() => setIndex((i) => i + 1)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { flex: 1, justifyContent: 'center', gap: space(4) },
  illustration: {
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(4),
  },
  languages: { gap: space(3), marginTop: space(4) },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: space(3) },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space(2) },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.primary },
  actions: { gap: space(3) },
});
