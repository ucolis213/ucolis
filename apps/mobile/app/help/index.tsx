// Aide : FAQ éditable depuis le back-office (recherche, accordéon) et contact du support.

import { Ionicons } from '@expo/vector-icons';
import { Fragment, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useContent } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { SectionCard } from '@/components/FormBits';
import { Markdown, parseFaq } from '@/components/Markdown';
import { MenuRow } from '@/components/MenuRow';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { normalizeSearch } from '@/components/Select';
import { TextField } from '@/components/TextField';
import { useAppConfig } from '@/hooks/useAppConfig';
import { currentLocale } from '@/i18n';
import { colors, space } from '@/theme';

export default function Help() {
  const { t } = useTranslation('common');
  const faq = useContent('faq', currentLocale());
  const config = useAppConfig();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const entries = useMemo(() => {
    const all = faq.data ? parseFaq(faq.data.body) : [];
    const q = normalizeSearch(search);
    return q ? all.filter((e) => normalizeSearch(`${e.question} ${e.answer}`).includes(q)) : all;
  }, [faq.data, search]);
  const support = config.data?.support;

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('help.title')} />}>
      <AppText size="lg" weight="bold">
        {t('help.faq')}
      </AppText>
      <TextField label={t('help.searchFaq')} value={search} onChangeText={setSearch} />
      {entries.length === 0 && !faq.isLoading && <AppText color={colors.textMuted}>{t('help.noContent')}</AppText>}
      {entries.map((e, i) => (
        <Fragment key={`${e.section}/${e.question}`}>
          {e.section && e.section !== entries[i - 1]?.section && (
            <AppText weight="bold" color={colors.primaryDark} style={{ marginTop: space(2) }}>
              {e.section}
            </AppText>
          )}
          <SectionCard>
            <Pressable
              onPress={() => setOpen(open === i ? null : i)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open === i }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}
            >
              <AppText weight="semibold" style={{ flex: 1 }}>
                {e.question}
              </AppText>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {open === i && <Markdown body={e.answer} />}
          </SectionCard>
        </Fragment>
      ))}
      {support && (
        <View style={{ gap: space(1) }}>
          <AppText size="lg" weight="bold">
            {t('help.contact')}
          </AppText>
          <MenuRow icon="mail-outline" label={`${t('help.email')} · ${support.email}`} onPress={() => Linking.openURL(`mailto:${support.email}`)} />
          <MenuRow
            icon="logo-whatsapp"
            label={`${t('help.whatsapp')} · ${support.whatsapp}`}
            onPress={() => Linking.openURL(`https://wa.me/${support.whatsapp.replace(/\D/g, '')}`)}
          />
        </View>
      )}
    </Screen>
  );
}
