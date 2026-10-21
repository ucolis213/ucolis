import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { KeyValue, SectionCard } from '@/components/FormBits';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { appVersion } from '@/hooks/useAppConfig';
import { space } from '@/theme';

export default function About() {
  const { t } = useTranslation('common');
  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('about.title')} />}>
      <View style={{ alignItems: 'center', paddingVertical: space(6) }}>
        <Logo size={64} />
      </View>
      <SectionCard>
        <KeyValue label={t('about.version')} value={appVersion()} />
        <KeyValue label={t('about.build')} value={Application.nativeBuildVersion ?? '-'} />
        <KeyValue label={t('about.channel')} value={Updates.channel ?? '-'} />
        <KeyValue label={t('about.runtime')} value={Updates.runtimeVersion ?? '-'} />
      </SectionCard>
    </Screen>
  );
}
