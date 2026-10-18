// CGU, politique de confidentialité ou FAQ brute, publiées depuis le back-office.

import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useContent } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Markdown } from '@/components/Markdown';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatDate } from '@/format';
import { currentLocale } from '@/i18n';
import { colors } from '@/theme';

const TITLES: Record<string, string> = { terms: 'profile:terms', privacy: 'profile:privacy', faq: 'common:help.faq' };

export default function ContentPage() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t } = useTranslation(['common', 'profile']);
  const query = useContent(key, currentLocale());
  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t(TITLES[key] ?? 'common:help.title')} />}>
      <QueryView query={query} isEmpty={(d) => !d.body.trim()} empty={{ icon: 'document-text-outline', title: t('help.noContent') }}>
        {(d) => (
          <>
            <AppText size="xs" color={colors.textMuted}>
              v{d.version} · {formatDate(d.publishedAt)}
            </AppText>
            <Markdown body={d.body} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}
