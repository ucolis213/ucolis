// À propos : présentation de UCOLIS, fonctionnement, contact, liens légaux et informations de version.

import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WILAYAS } from '@ucolis/shared';
import { AppText } from '@/components/AppText';
import { KeyValue, SectionCard } from '@/components/FormBits';
import { Logo } from '@/components/Logo';
import { MenuRow, MenuSection } from '@/components/MenuRow';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { appVersion, useAppConfig } from '@/hooks/useAppConfig';
import { colors, space } from '@/theme';

const STEPS = [
  { icon: 'create-outline', key: 'step1' },
  { icon: 'pricetags-outline', key: 'step2' },
  { icon: 'navigate-outline', key: 'step3' },
  { icon: 'checkmark-done-outline', key: 'step4' },
] as const;

const VALUES = [
  { icon: 'shield-checkmark-outline', key: 'value1' },
  { icon: 'cash-outline', key: 'value2' },
  { icon: 'eye-outline', key: 'value3' },
  { icon: 'map-outline', key: 'value4' },
] as const;

/** Ligne icône, titre et texte, pour les étapes et les engagements. */
function Feature({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1, gap: space(0.5) }}>
        <AppText weight="semibold">{title}</AppText>
        <AppText size="sm" color={colors.textMuted}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

export default function About() {
  const { t } = useTranslation(['common', 'profile']);
  const support = useAppConfig().data?.support;

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('about.title')} />}>
      <View style={{ alignItems: 'center', paddingVertical: space(4), gap: space(3) }}>
        <Logo size={64} />
        <AppText align="center" color={colors.textMuted}>
          {t('about.tagline')}
        </AppText>
      </View>

      <SectionCard title={t('about.missionTitle')}>
        <AppText>{t('about.mission')}</AppText>
      </SectionCard>

      <SectionCard title={t('about.howTitle')}>
        {STEPS.map((s) => (
          <Feature
            key={s.key}
            icon={s.icon}
            title={t(`about.${s.key}Title`)}
            body={t(`about.${s.key}`)}
          />
        ))}
      </SectionCard>

      <SectionCard title={t('about.valuesTitle')}>
        {VALUES.map((v) => (
          <Feature
            key={v.key}
            icon={v.icon}
            title={t(`about.${v.key}Title`)}
            body={t(`about.${v.key}`, { n: WILAYAS.length })}
          />
        ))}
      </SectionCard>

      {support && (
        <MenuSection title={t('about.contactTitle')}>
          <MenuRow
            icon="mail-outline"
            label={support.email}
            onPress={() => Linking.openURL(`mailto:${support.email}`)}
          />
          <MenuRow
            icon="logo-whatsapp"
            label={support.whatsapp}
            onPress={() => Linking.openURL(`https://wa.me/${support.whatsapp.replace(/\D/g, '')}`)}
          />
        </MenuSection>
      )}

      <MenuSection title={t('about.legalTitle')}>
        <MenuRow
          icon="document-text-outline"
          label={t('profile:terms')}
          onPress={() => router.push('/help/content/terms')}
        />
        <MenuRow
          icon="lock-closed-outline"
          label={t('profile:privacy')}
          onPress={() => router.push('/help/content/privacy')}
        />
      </MenuSection>

      <SectionCard title={t('about.appTitle')}>
        <KeyValue label={t('about.version')} value={appVersion()} />
        <KeyValue label={t('about.build')} value={Application.nativeBuildVersion ?? '-'} />
        <KeyValue label={t('about.channel')} value={Updates.channel ?? '-'} />
        <KeyValue label={t('about.runtime')} value={Updates.runtimeVersion ?? '-'} />
      </SectionCard>

      <AppText size="xs" align="center" color={colors.textMuted}>
        {t('about.copyright', { year: new Date().getFullYear() })}
      </AppText>
    </Screen>
  );
}
