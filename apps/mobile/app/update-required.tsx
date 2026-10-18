// Écran bloquant : la version installée est inférieure à minAppVersion.

import { Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/States';

const STORE_URL = Platform.select({
  ios: 'itms-apps://apps.apple.com/app/ucolis',
  default: 'market://details?id=dz.ucolis.app',
});

export default function UpdateRequired() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ justifyContent: 'center' }}>
      <EmptyState
        icon="cloud-download-outline"
        title={t('updateRequired.title')}
        body={t('updateRequired.body')}
      />
      <Button label={t('updateRequired.action')} onPress={() => Linking.openURL(STORE_URL)} />
    </Screen>
  );
}
