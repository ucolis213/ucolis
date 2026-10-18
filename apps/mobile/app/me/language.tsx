import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@ucolis/shared';
import { api } from '@/api/client';
import { confirm } from '@/components/ConfirmDialog';
import { MenuRow, MenuSection } from '@/components/MenuRow';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { changeLanguage, currentLocale } from '@/i18n';
import { useSession } from '@/session/SessionContext';
import { colors } from '@/theme';

export default function Language() {
  const { t } = useTranslation(['common', 'profile']);
  const { isGuest } = useSession();

  async function choose(l: Locale) {
    if (l === currentLocale()) return;
    if (!(await confirm({ title: t('language'), message: t('profile:languageRestart') }))) return;
    // La langue est enregistrée côté serveur pour les push et les emails.
    if (!isGuest) await api.patch('/me/preferences', { language: l }).catch(() => undefined);
    await changeLanguage(l);
  }

  return (
    <Screen edges={['top', 'bottom']} header={<ScreenHeader title={t('language')} />}>
        <MenuSection>
          {LOCALES.map((l) => (
            <MenuRow
              key={l}
              icon="language-outline"
              label={t(`languages.${l}`)}
              onPress={() => choose(l)}
              right={currentLocale() === l ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : <></>}
            />
          ))}
        </MenuSection>
    </Screen>
  );
}
