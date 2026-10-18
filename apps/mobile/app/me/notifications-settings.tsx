import { useState } from 'react';
import { Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MANDATORY_CATEGORIES, NOTIFICATION_CATEGORIES, type Me, type NotificationCategory } from '@ucolis/shared';
import { api } from '@/api/client';
import { AppText } from '@/components/AppText';
import { MenuRow, MenuSection } from '@/components/MenuRow';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useSession } from '@/session/SessionContext';
import { colors } from '@/theme';

const ICONS: Record<NotificationCategory, 'pricetag-outline' | 'cube-outline' | 'chatbubbles-outline' | 'notifications-outline' | 'shield-checkmark-outline' | 'megaphone-outline'> = {
  offers: 'pricetag-outline',
  deliveries: 'cube-outline',
  messages: 'chatbubbles-outline',
  alerts_trips: 'notifications-outline',
  account: 'shield-checkmark-outline',
  announcements: 'megaphone-outline',
};

export default function NotificationSettings() {
  const { t } = useTranslation('profile');
  const { user, setUser } = useSession();
  const [prefs, setPrefs] = useState(user?.preferences.notifications ?? {});

  async function toggle(category: NotificationCategory, enabled: boolean) {
    setPrefs((p) => ({ ...p, [category]: enabled }));
    try {
      setUser(await api.patch<Me>('/me/preferences', { notifications: { [category]: enabled } }));
    } catch {
      setPrefs((p) => ({ ...p, [category]: !enabled }));
    }
  }

  return (
    <Screen edges={['top', 'bottom']} header={<ScreenHeader title={t('notificationsSettings')} />}>
        <MenuSection>
          {NOTIFICATION_CATEGORIES.map((c) => {
            const locked = MANDATORY_CATEGORIES.includes(c);
            return (
              <MenuRow
                key={c}
                icon={ICONS[c]}
                label={t(`categories.${c}`)}
                right={
                  locked ? (
                    <AppText size="xs" color={colors.textMuted}>
                      {t('accountCategoryLocked')}
                    </AppText>
                  ) : (
                    <Switch
                      value={prefs[c] !== false}
                      onValueChange={(v) => toggle(c, v)}
                      trackColor={{ true: colors.primary, false: colors.border }}
                      accessibilityLabel={t(`categories.${c}`)}
                    />
                  )
                }
              />
            );
          })}
        </MenuSection>
    </Screen>
  );
}
