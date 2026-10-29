// Liste des conversations, mise à jour en direct par le socket.

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatNotificationParams, formatPrice, type ConversationDto } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { useConversations } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { confirm } from '@/components/ConfirmDialog';
import { GuestGate } from '@/components/GuestGate';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { SwipeableRow } from '@/components/SwipeableRow';
import { formatRelative } from '@/format';
import { currentLocale } from '@/i18n';
import { useSession } from '@/session/SessionContext';
import { badgeText, colors, MAX_FONT_SCALE, radii, space } from '@/theme';
import { useTabBarSpace } from '@/components/TabBar';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function Messages() {
  const { t } = useTranslation(['chat', 'common']);
  const tabSpace = useTabBarSpace();
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
              contentContainerStyle={{ paddingBottom: tabSpace + space(2) }}
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
  const qc = useQueryClient();
  const last = conv.lastMessage;
  // Supprimée pour moi seul ; retirée de la liste avant la réponse de l'API.
  const remove = async () => {
    if (!(await confirm({ title: t('deleteConfirm'), message: t('deleteConfirmBody'), confirmLabel: t('common:delete'), destructive: true }))) return;
    qc.setQueryData<{ items: ConversationDto[] }>(['conversations'], (old) => old && { items: old.items.filter((c) => c.id !== conv.id) });
    try {
      await api.delete(`/conversations/${conv.id}`);
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    }
    void qc.invalidateQueries({ queryKey: ['conversations'] });
  };
  const preview = last.type === 'system' ? t(`system.${last.text}`, { ...formatNotificationParams(last.params ?? {}, currentLocale(), formatPrice), defaultValue: '' }) : last.type === 'image' ? `📷 ${t('photo')}` : (last.text ?? '');
  return (
    <SwipeableRow key={conv.id} actionLabel={t('deleteConversation')} actionIcon="trash-outline" onAction={remove}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.border }]}
        onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: conv.id } })}
        onLongPress={remove}
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
                <Text style={badgeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {conv.unread > 99 ? '99+' : conv.unread}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: space(5), paddingVertical: space(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(5), paddingVertical: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: radii.chip, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
