import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/States';
import { useAppConfig } from '@/hooks/useAppConfig';
import { currentLocale } from '@/i18n';

export default function Maintenance() {
  const { t } = useTranslation();
  const config = useAppConfig();
  const custom = config.data?.maintenance.message[currentLocale()];

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ justifyContent: 'center' }}>
      <EmptyState
        icon="construct-outline"
        title={t('maintenance.title')}
        body={custom || t('maintenance.body')}
      />
      <Button
        label={t('retry')}
        variant="outline"
        loading={config.isFetching}
        onPress={async () => {
          const res = await config.refetch();
          if (res.data && !res.data.maintenance.enabled) router.replace('/');
        }}
      />
    </Screen>
  );
}
