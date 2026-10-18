// Discussion (F13) : envoi optimiste dédoublonné par clientId, nouvel essai en cas d'échec,
// « en train d'écrire » (3 s), accusé « Vu », anciens messages par pages de 30, messages système traduits.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TYPING_TIMEOUT_MS, formatNotificationParams, formatPrice, type FileRef, type MessageDto } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { compressImage, uploadFile } from '@/api/upload';
import { useConversation, useMessages } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Avatar, cdn } from '@/components/Avatar';
import { confirm } from '@/components/ConfirmDialog';
import { askSource, pickImages } from '@/components/PhotoPicker';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatTime } from '@/format';
import { currentLocale } from '@/i18n';
import { emitWithAck, useSocket, useSocketEvent } from '@/realtime/socket';
import { useSession } from '@/session/SessionContext';
import { colors, fontFamily, MIN_TOUCH, radii, space } from '@/theme';

type Page = { items: MessageDto[]; hasMore: boolean };
type Local = MessageDto & { local?: 'sending' | 'failed' };

const newClientId = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function Conversation() {
  const { t } = useTranslation(['chat', 'common', 'profile']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { socket, connected } = useSocket();
  const qc = useQueryClient();
  const conv = useConversation(id);
  const messages = useMessages(id);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Local[]>([]);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const items: Local[] = useMemo(() => {
    const server = messages.data?.pages.flatMap((p) => p.items) ?? [];
    const known = new Set(server.map((m) => m.clientId).filter(Boolean));
    return [...pending.filter((p) => !known.has(p.clientId)), ...server];
  }, [messages.data, pending]);

  const markRead = useCallback(() => {
    if (socket?.connected) socket.emit('conversation:read', { conversationId: id });
    else void api.post(`/conversations/${id}/read`).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ['conversations'] });
  }, [socket, id, qc]);

  // Room de la conversation : pas de push pendant qu'elle est ouverte à l'écran.
  useEffect(() => {
    if (!socket || !connected) return;
    void emitWithAck(socket, 'conversation:join', { conversationId: id }).catch(() => undefined);
    markRead();
    // File d'envoi rejouée au retour du réseau.
    pending.filter((p) => p.local === 'failed').forEach((p) => void send(p));
    return () => {
      socket.emit('conversation:leave', { conversationId: id });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connected, id]);

  useSocketEvent<MessageDto>('message:new', (m) => {
    if (m.conversationId === id && m.authorId !== user?.id) markRead();
  });
  useSocketEvent<{ conversationId: string; userId: string; isTyping: boolean }>('typing', (e) => {
    if (e.conversationId !== id || e.userId === user?.id) return;
    setTyping(e.isTyping);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (e.isTyping) typingTimer.current = setTimeout(() => setTyping(false), TYPING_TIMEOUT_MS);
  });
  useSocketEvent<{ conversationId: string }>('messages:read', (e) => {
    if (e.conversationId === id) void qc.invalidateQueries({ queryKey: ['messages', id] });
  });

  function onChange(v: string) {
    setText(v);
    const now = Date.now();
    if (socket?.connected && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      socket.emit('typing', { conversationId: id, isTyping: v.length > 0 });
    }
  }

  async function send(m: Local) {
    setPending((cur) => [m, ...cur.filter((x) => x.clientId !== m.clientId)].map((x) => (x.clientId === m.clientId ? { ...x, local: 'sending' } : x)));
    const body = m.type === 'image' ? { type: 'image', clientId: m.clientId, image: m.image } : { type: 'text', clientId: m.clientId, text: m.text };
    try {
      const saved =
        socket?.connected
          ? await emitWithAck<MessageDto>(socket, 'message:send', { conversationId: id, ...body })
          : await api.post<MessageDto>(`/conversations/${id}/messages`, body);
      qc.setQueryData<InfiniteData<Page>>(['messages', id], (old) => {
        if (!old?.pages[0] || old.pages.some((p) => p.items.some((x) => x.id === saved.id))) return old;
        return { ...old, pages: [{ ...old.pages[0], items: [saved, ...old.pages[0].items] }, ...old.pages.slice(1)] };
      });
      setPending((cur) => cur.filter((x) => x.clientId !== m.clientId));
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      setPending((cur) => cur.map((x) => (x.clientId === m.clientId ? { ...x, local: 'failed' } : x)));
      const code = (err as { code?: string }).code;
      if (code === 'BLOCKED' || code === 'EMAIL_NOT_VERIFIED') Alert.alert(errorMessage(t, err));
    }
  }

  function draft(partial: Partial<MessageDto>): Local {
    return {
      id: partial.clientId!,
      conversationId: id,
      authorId: user?.id ?? null,
      type: 'text',
      text: null,
      image: null,
      systemKey: null,
      systemParams: null,
      clientId: newClientId(),
      readBy: [],
      deleted: false,
      createdAt: new Date().toISOString(),
      ...partial,
    } as Local;
  }

  function sendText() {
    const value = text.trim();
    if (!value) return;
    setText('');
    socket?.emit('typing', { conversationId: id, isTyping: false });
    const clientId = newClientId();
    void send(draft({ clientId, id: clientId, text: value }));
  }

  async function sendImage() {
    const source = await askSource();
    if (!source) return;
    const [asset] = await pickImages(source, 1);
    if (!asset) return;
    try {
      const image: FileRef = await uploadFile('message_image', { uri: await compressImage(asset.uri, asset.width, asset.height) });
      const clientId = newClientId();
      void send(draft({ clientId, id: clientId, type: 'image', image }));
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    }
  }

  function menu() {
    const c = conv.data;
    if (!c) return;
    const options = [c.muted ? t('unmute') : t('mute'), t('reportConversation'), t('blockUser'), t('common:cancel')];
    const handle = async (i: number) => {
      if (i === 0) {
        await api.post(`/conversations/${id}/mute`, { muted: !c.muted });
        void conv.refetch();
      } else if (i === 1) router.push({ pathname: '/report', params: { type: 'conversation', id } });
      else if (i === 2 && (await confirm({ title: t('blockUser'), message: t('profile:blockConfirm', { name: c.other.displayName }), destructive: true }))) {
        await api.post(`/me/blocked/${c.other.id}`);
        router.back();
      }
    };
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 3, destructiveButtonIndex: 2 }, handle);
    else Alert.alert(c.other.displayName, undefined, options.slice(0, 3).map((o, i) => ({ text: o, onPress: () => void handle(i) })).concat([{ text: options[3]!, onPress: () => undefined }]));
  }

  const c = conv.data;
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        padded={false}
        edges={['top', 'bottom']}
        header={
          <View>
            <ScreenHeader
              title={c?.other.displayName ?? ''}
              right={
                <Pressable onPress={menu} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common:more')}>
                  <Ionicons name="ellipsis-vertical" size={22} color={colors.navy} />
                </Pressable>
              }
            />
            {c?.parcel && (
              <Pressable style={styles.parcel} onPress={() => router.push({ pathname: '/parcel/[id]', params: { id: c.parcel!.id } })} accessibilityRole="link">
                <Ionicons name="cube-outline" size={16} color={colors.primaryDark} />
                <AppText size="sm" color={colors.primaryDark} numberOfLines={1} style={styles.flex}>
                  {t('about', { title: c.parcel.title })}
                </AppText>
              </Pressable>
            )}
            {typing && (
              <AppText size="xs" color={colors.textMuted} style={styles.typing}>
                {t('typing')}
              </AppText>
            )}
          </View>
        }
      >
        <FlatList
          inverted
          data={items}
          keyExtractor={(m) => m.clientId ?? m.id}
          contentContainerStyle={styles.list}
          onEndReached={() => messages.hasNextPage && !messages.isFetchingNextPage && messages.fetchNextPage()}
          renderItem={({ item, index }) => (
            <Bubble
              m={item}
              mine={item.authorId === user?.id}
              otherId={c?.other.id}
              showAvatar={item.authorId !== user?.id && items[index - 1]?.authorId !== item.authorId}
              avatar={c ? { file: c.other.avatar, name: c.other.displayName } : null}
              onRetry={() => send(item)}
              onReport={() => router.push({ pathname: '/report', params: { type: 'message', id: item.id } })}
            />
          )}
        />
        <View style={styles.composer}>
          <Pressable onPress={sendImage} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('photo')}>
            <Ionicons name="image-outline" size={24} color={colors.textMuted} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={onChange}
            placeholder={t('placeholder')}
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={2000}
            style={[styles.input, { fontFamily: fontFamily() }]}
          />
          <Pressable onPress={sendText} style={[styles.send, !text.trim() && { opacity: 0.4 }]} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel={t('common:send')}>
            <Ionicons name="send" size={18} color="#FFFFFF" style={{ transform: [{ scaleX: currentLocale() === 'ar' ? -1 : 1 }] }} />
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Bubble({
  m,
  mine,
  otherId,
  showAvatar,
  avatar,
  onRetry,
  onReport,
}: {
  m: Local;
  mine: boolean;
  otherId?: string;
  showAvatar: boolean;
  avatar: { file: FileRef | null; name: string } | null;
  onRetry: () => void;
  onReport: () => void;
}) {
  const { t } = useTranslation('chat');
  if (m.type === 'system') {
    const params = formatNotificationParams(m.systemParams ?? {}, currentLocale(), formatPrice);
    return (
      <View style={styles.system}>
        <AppText size="xs" weight="medium" color={colors.textMuted} align="center">
          {t(`system.${m.systemKey}`, params)}
        </AppText>
      </View>
    );
  }
  const seen = mine && otherId && m.readBy.includes(otherId);
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowOther]}>
      {!mine && <View style={styles.avatarSlot}>{showAvatar && avatar && <Avatar file={avatar.file} name={avatar.name} size={28} />}</View>}
      <Pressable
        onLongPress={!mine && !m.local ? onReport : undefined}
        onPress={m.local === 'failed' ? onRetry : undefined}
        style={[styles.bubble, mine ? styles.mine : styles.other]}
        accessibilityRole={m.local === 'failed' ? 'button' : undefined}
      >
        {m.deleted ? (
          <AppText size="sm" color={colors.textMuted}>
            {t('deletedMessage')}
          </AppText>
        ) : m.type === 'image' && m.image ? (
          <Image source={{ uri: m.image.url.startsWith('http') ? cdn(m.image.url, 600) : m.image.url }} style={styles.image} contentFit="cover" />
        ) : (
          <AppText color={mine ? '#FFFFFF' : colors.navy}>{m.text}</AppText>
        )}
        <AppText size="xs" color={mine ? 'rgba(255,255,255,0.8)' : colors.textMuted} align="right">
          {m.local === 'sending' ? t('sending') : m.local === 'failed' ? t('failed') : `${formatTime(m.createdAt)}${seen ? ` · ${t('seen')}` : ''}`}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  parcel: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginHorizontal: space(4), marginBottom: space(2), padding: space(2), borderRadius: radii.input, backgroundColor: colors.primarySoft },
  typing: { paddingHorizontal: space(5), paddingBottom: space(1) },
  list: { padding: space(4), gap: space(2) },
  system: { alignSelf: 'center', paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radii.chip, backgroundColor: colors.border, marginVertical: space(1) },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2) },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSlot: { width: 28 },
  bubble: { maxWidth: '78%', padding: space(3), borderRadius: radii.card, gap: space(1) },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  other: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  image: { width: 200, height: 200, borderRadius: radii.input },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2), padding: space(3), backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  iconBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, maxHeight: 120, minHeight: MIN_TOUCH, paddingHorizontal: space(3), paddingVertical: space(2.5), borderRadius: radii.card, backgroundColor: colors.background, color: colors.navy, textAlign: 'auto' },
  send: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
