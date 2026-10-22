// Liste des conversations, mise à jour en direct par le socket.

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatNotificationParams, formatPrice, type ConversationDto } from '@ucolis/shared';
import { useConversations } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { GuestGate } from '@/components/GuestGate';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { formatRelative } from '@/format';
import { currentLocale } from '@/i18n';
import { useSession } from '@/session/SessionContext';
import { colors, radii, space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function Messages() {
  const { t } = useTranslation(['chat', 'common']);
  const { isGuest } = useSession();
  const query = useConversations(!isGuest);
  const pull = usePullToRefresh(query.refetch);
  if (isGuest) {
    return (
      <Screen>
        <AppText size="xl" weight="bold">
          {t('title')}
        </AppText>
        <GuestGate returnTo="/messages" />
      </Screen>
    );
  }
  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold">
          {t('title')}
        </AppText>
      </View>
      <View style={styles.flex}>
        <QueryView query={query} isEmpty={(d) => d.items.length === 0} empty={{ icon: 'chatbubbles-outline', title: t('empty') }}>
          {(data) => (
            <FlashList
              data={data.items}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => <ConversationRow conv={item} />}
              {...pull}
            />
          )}
        </QueryView>
      </View>
    </Screen>
  );
}

function ConversationRow({ conv }: { conv: ConversationDto }) {
  const { t } = useTranslation('chat');
  const last = conv.lastMessage;
  const preview = last.type === 'system' ? t(`system.${last.text}`, { ...formatNotificationParams(last.params ?? {}, currentLocale(), formatPrice), defaultValue: '' }) : last.type === 'image' ? `📷 ${t('photo')}` : (last.text ?? '');
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.background }]}
      onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: conv.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${conv.other.displayName}, ${preview}`}
    >
      <Avatar file={conv.other.avatar} name={conv.other.displayName} size={52} />
      <View style={styles.flex}>
        <View style={styles.line}>
          <AppText weight={conv.unread ? 'bold' : 'semibold'} numberOfLines={1} style={styles.flex}>
            {conv.other.displayName}
          </AppText>
          {last.at && (
            <AppText size="xs" color={colors.textMuted}>
              {formatRelative(last.at)}
            </AppText>
          )}
        </View>
        {conv.parcel && (
          <AppText size="xs" color={colors.primaryDark} numberOfLines={1}>
            {conv.parcel.reference} · {conv.parcel.title}
          </AppText>
        )}
        <View style={styles.line}>
          <AppText size="sm" color={conv.unread ? colors.navy : colors.textMuted} numberOfLines={1} style={styles.flex}>
            {preview}
          </AppText>
          {conv.muted && <Ionicons name="notifications-off-outline" size={14} color={colors.textMuted} />}
          {conv.unread > 0 && (
            <View style={styles.badge}>
              <AppText size="xs" weight="bold" color="#FFFFFF">
                {conv.unread}
              </AppText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: space(5), paddingVertical: space(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(5), paddingVertical: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: radii.chip, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
