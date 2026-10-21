// Centre de notifications : liste paginée, lu / tout lu, suppression, ouverture par lien profond.

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NOTIFICATION_TYPES, formatNotificationParams, formatPrice, type NotificationCategory, type NotificationDto, type NotificationType } from '@ucolis/shared';
import { api } from '@/api/client';
import { useNotifications } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { confirm } from '@/components/ConfirmDialog';
import { GuestGate } from '@/components/GuestGate';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatRelative } from '@/format';
import { currentLocale } from '@/i18n';
import { linkToHref } from '@/notifications/push';
import { useSession } from '@/session/SessionContext';
import { colors, space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const ICONS: Record<NotificationCategory, keyof typeof Ionicons.glyphMap> = {
  offers: 'pricetag',
  deliveries: 'cube',
  messages: 'chatbubble',
  alerts_trips: 'notifications',
  account: 'shield-checkmark',
  announcements: 'megaphone',
};

export default function Notifications() {
  const { t } = useTranslation(['notif', 'common']);
  const { isGuest } = useSession();
  const qc = useQueryClient();
  const query = useNotifications(!isGuest);
  const pull = usePullToRefresh(query.refetch);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  async function open(n: NotificationDto) {
    if (!n.readAt) await api.post(`/notifications/${n.id}/read`).catch(() => undefined);
    void refresh();
    const href = n.link ? linkToHref(n.link) : null;
    if (href) router.push(href);
  }

  return (
    <Screen
      padded={false}
      edges={['top', 'bottom']}
      header={
        <ScreenHeader
          title={t('title')}
          right={
            !isGuest && items.length > 0 ? (
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('markAllRead')}
                onPress={async () => {
                  await api.post('/notifications/read-all');
                  void refresh();
                }}
              >
                <Ionicons name="checkmark-done" size={24} color={colors.navy} />
              </Pressable>
            ) : undefined
          }
        />
      }
    >
      {isGuest ? (
        <GuestGate returnTo="/notifications" />
      ) : (
        <QueryView query={{ ...query, data: items }} isEmpty={(d) => d.length === 0} empty={{ icon: 'notifications-outline', title: t('empty') }}>
          {(data) => (
            <FlashList
              data={data}
              keyExtractor={(n) => n.id}
              onEndReached={() => query.hasNextPage && query.fetchNextPage()}
              {...pull}
              renderItem={({ item }) => <Row n={item} onPress={() => open(item)} />}
              ListFooterComponent={
                <AppText
                  align="center"
                  size="sm"
                  color={colors.danger}
                  style={{ padding: space(5) }}
                  onPress={async () => {
                    if (await confirm({ title: t('deleteAll'), message: t('deleteAllConfirm'), destructive: true })) {
                      await api.delete('/notifications');
                      void refresh();
                    }
                  }}
                >
                  {t('deleteAll')}
                </AppText>
              }
            />
          )}
        </QueryView>
      )}
    </Screen>
  );
}

function Row({ n, onPress }: { n: NotificationDto; onPress: () => void }) {
  const { t } = useTranslation('notif');
  const params = formatNotificationParams(n.params, currentLocale(), formatPrice);
  const category = NOTIFICATION_TYPES[n.type as NotificationType]?.category ?? 'account';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !n.readAt && styles.unread, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <View style={styles.icon}>
        <Ionicons name={ICONS[category]} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <View style={styles.line}>
          <AppText weight={n.readAt ? 'medium' : 'bold'} style={styles.flex} numberOfLines={1}>
            {t(n.titleKey.replace(/^notif\./, ''), params)}
          </AppText>
          <AppText size="xs" color={colors.textMuted}>
            {formatRelative(n.createdAt)}
          </AppText>
        </View>
        <AppText size="sm" color={colors.textMuted} numberOfLines={2}>
          {t(n.bodyKey.replace(/^notif\./, ''), params)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space(3), padding: space(4), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  unread: { backgroundColor: colors.primarySoft },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
