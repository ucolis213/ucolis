// Discussion (F13) : envoi optimiste dédoublonné par clientId, nouvel essai en cas d'échec,
// « en train d'écrire » (3 s), accusé « Vu », anciens messages par pages de 30, messages système traduits.
// Une photo choisie reste en aperçu (retirable) jusqu'à l'envoi ; un toucher sur une photo l'ouvre en plein écran.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  TYPING_TIMEOUT_MS,
  formatNotificationParams,
  formatPrice,
  type FileRef,
  type MessageDto,
} from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { compressImage, uploadFile } from '@/api/upload';
import { useConversation, useMessages } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Avatar, cdn } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { confirm } from '@/components/ConfirmDialog';
import { askSource, pickImages } from '@/components/PhotoPicker';
import { PhotoViewer } from '@/components/PhotoViewer';
import { RatingStars } from '@/components/RatingStars';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatTime } from '@/format';
import { currentLocale } from '@/i18n';
import { emitWithAck, useSocket, useSocketEvent } from '@/realtime/socket';
import { useSession } from '@/session/SessionContext';
import { colors, fontFamily, MIN_TOUCH, radii, space } from '@/theme';

type Page = { items: MessageDto[]; hasMore: boolean };
type Local = MessageDto & { local?: 'sending' | 'failed' };
type Attachment = { uri: string; width?: number; height?: number };

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
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const items: Local[] = useMemo(() => {
    const server = messages.data?.pages.flatMap((p) => p.items) ?? [];
    const known = new Set(server.map((m) => m.clientId).filter(Boolean));
    return [...pending.filter((p) => !known.has(p.clientId)), ...server];
  }, [messages.data, pending]);

  // Photos de la discussion dans l'ordre chronologique, pour feuilleter dans la visionneuse.
  const photos = useMemo(
    () =>
      items
        .filter((m) => m.type === 'image' && m.image && !m.local && !m.deleted)
        .map((m) => m.image!)
        .reverse(),
    [items],
  );

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
    setPending((cur) =>
      [m, ...cur.filter((x) => x.clientId !== m.clientId)].map((x) =>
        x.clientId === m.clientId ? { ...x, local: 'sending' } : x,
      ),
    );
    const body =
      m.type === 'image'
        ? { type: 'image', clientId: m.clientId, image: m.image }
        : { type: 'text', clientId: m.clientId, text: m.text };
    try {
      const saved = socket?.connected
        ? await emitWithAck<MessageDto>(socket, 'message:send', { conversationId: id, ...body })
        : await api.post<MessageDto>(`/conversations/${id}/messages`, body);
      qc.setQueryData<InfiniteData<Page>>(['messages', id], (old) => {
        if (!old?.pages[0] || old.pages.some((p) => p.items.some((x) => x.id === saved.id)))
          return old;
        return {
          ...old,
          pages: [
            { ...old.pages[0], items: [saved, ...old.pages[0].items] },
            ...old.pages.slice(1),
          ],
        };
      });
      setPending((cur) => cur.filter((x) => x.clientId !== m.clientId));
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      setPending((cur) =>
        cur.map((x) => (x.clientId === m.clientId ? { ...x, local: 'failed' } : x)),
      );
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

  async function sendMessage() {
    const value = text.trim();
    if ((!value && !attachment) || uploading) return;
    socket?.emit('typing', { conversationId: id, isTyping: false });
    if (attachment) {
      setUploading(true);
      try {
        const image: FileRef = await uploadFile('message_image', {
          uri: await compressImage(attachment.uri, attachment.width, attachment.height),
        });
        setAttachment(null);
        const clientId = newClientId();
        void send(draft({ clientId, id: clientId, type: 'image', image }));
      } catch (err) {
        // La photo reste en aperçu pour un nouvel essai.
        Alert.alert(errorMessage(t, err));
        return;
      } finally {
        setUploading(false);
      }
    }
    if (value) {
      setText('');
      const clientId = newClientId();
      void send(draft({ clientId, id: clientId, text: value }));
    }
  }

  async function pickPhoto() {
    const source = await askSource();
    if (!source) return;
    const [asset] = await pickImages(source, 1);
    if (asset) setAttachment({ uri: asset.uri, width: asset.width, height: asset.height });
  }

  function openProfile() {
    if (conv.data) router.push({ pathname: '/user/[id]', params: { id: conv.data.other.id } });
  }

  // Bloquer demande confirmation ; débloquer est immédiat. On reste dans la discussion, qui passe en lecture seule.
  async function toggleBlock() {
    const c = conv.data;
    if (!c) return;
    try {
      if (c.blockedByMe) await api.delete(`/me/blocked/${c.other.id}`);
      else if (
        await confirm({
          title: t('blockUser'),
          message: t('profile:blockConfirm', { name: c.other.displayName }),
          destructive: true,
        })
      ) {
        await api.post(`/me/blocked/${c.other.id}`);
      } else return;
      await Promise.all([
        conv.refetch(),
        qc.invalidateQueries({ queryKey: ['me', 'blocked'] }),
        qc.invalidateQueries({ queryKey: ['conversations'] }),
      ]);
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    }
  }

  function menu() {
    const c = conv.data;
    if (!c) return;
    const options = [
      t('viewProfile'),
      c.muted ? t('unmute') : t('mute'),
      t('reportConversation'),
      c.blockedByMe ? t('unblockUser') : t('blockUser'),
      t('common:cancel'),
    ];
    const handle = async (i: number) => {
      if (i === 0) openProfile();
      else if (i === 1) {
        await api.post(`/conversations/${id}/mute`, { muted: !c.muted });
        void conv.refetch();
      } else if (i === 2)
        router.push({ pathname: '/report', params: { type: 'conversation', id } });
      else if (i === 3) await toggleBlock();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 4, destructiveButtonIndex: c.blockedByMe ? undefined : 3 },
        handle,
      );
    } else {
      Alert.alert(
        c.other.displayName,
        undefined,
        options
          .slice(0, 4)
          .map((o, i) => ({ text: o, onPress: () => void handle(i) }))
          .concat([{ text: options[4]!, onPress: () => undefined }]),
      );
    }
  }

  const c = conv.data;
  return (
    <>
      <Screen
        padded={false}
        edges={['top', 'bottom']}
        header={
          <View>
            <ScreenHeader
              title={c?.other.displayName ?? ''}
              titleContent={
                c && (
                  <Pressable
                    onPress={openProfile}
                    style={styles.who}
                    accessibilityRole="button"
                    accessibilityLabel={c.other.displayName}
                    accessibilityHint={t('viewProfile')}
                  >
                    <Avatar file={c.other.avatar} name={c.other.displayName} size={36} />
                    <View style={styles.flex}>
                      <AppText weight="bold" numberOfLines={1}>
                        {c.other.displayName}
                      </AppText>
                      <View style={styles.badges}>
                        {c.other.badges.identity ? (
                          <Badge kind="identity" />
                        ) : (
                          <AppText size="xs" color={colors.textMuted}>
                            {t('identityNotVerified')}
                          </AppText>
                        )}
                        {c.other.badges.pro && <Badge kind="pro" />}
                        {c.other.rating.count > 0 && (
                          <RatingStars
                            value={c.other.rating.average}
                            count={c.other.rating.count}
                            size={11}
                          />
                        )}
                      </View>
                    </View>
                  </Pressable>
                )
              }
              right={
                <Pressable
                  onPress={menu}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('common:more')}
                >
                  <Ionicons name="ellipsis-vertical" size={22} color={colors.navy} />
                </Pressable>
              }
            />
            {c?.parcel && (
              <Pressable
                style={styles.parcel}
                onPress={() =>
                  router.push({ pathname: '/parcel/[id]', params: { id: c.parcel!.id } })
                }
                accessibilityRole="link"
              >
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
          onEndReached={() =>
            messages.hasNextPage && !messages.isFetchingNextPage && messages.fetchNextPage()
          }
          renderItem={({ item, index }) => (
            <Bubble
              m={item}
              mine={item.authorId === user?.id}
              otherId={c?.other.id}
              showAvatar={
                item.authorId !== user?.id && items[index - 1]?.authorId !== item.authorId
              }
              avatar={c ? { file: c.other.avatar, name: c.other.displayName } : null}
              onRetry={() => send(item)}
              onOpenImage={() =>
                setViewer(photos.findIndex((p) => p.publicId === item.image?.publicId))
              }
              onReport={() =>
                router.push({ pathname: '/report', params: { type: 'message', id: item.id } })
              }
              onOpenProfile={openProfile}
            />
          )}
        />
        {c && !c.canSend ? (
          <View style={styles.blockedBar}>
            <AppText size="sm" color={colors.textMuted} align="center">
              {c.blockedByMe ? t('blockedByMe', { name: c.other.displayName }) : t('cannotReply')}
            </AppText>
            {c.blockedByMe && (
              <Button
                label={t('profile:unblock')}
                variant="ghost"
                fullWidth={false}
                onPress={toggleBlock}
              />
            )}
          </View>
        ) : (
          <>
            {attachment && (
              <View style={styles.attachment}>
                <View>
                  <Image
                    source={{ uri: attachment.uri }}
                    style={styles.attachmentImage}
                    contentFit="cover"
                  />
                  {!uploading && (
                    <Pressable
                      onPress={() => setAttachment(null)}
                      hitSlop={10}
                      style={styles.removeAttachment}
                      accessibilityRole="button"
                      accessibilityLabel={t('removePhoto')}
                    >
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </Pressable>
                  )}
                </View>
              </View>
            )}
            <View style={[styles.composer, !!attachment && { borderTopWidth: 0 }]}>
              <Pressable
                onPress={pickPhoto}
                disabled={uploading}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel={t('photo')}
              >
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
              <Pressable
                onPress={sendMessage}
                style={[
                  styles.send,
                  !((!!text.trim() || !!attachment) && !uploading) &&
                    !uploading && { opacity: 0.4 },
                ]}
                disabled={!((!!text.trim() || !!attachment) && !uploading)}
                accessibilityRole="button"
                accessibilityLabel={t('common:send')}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name="send"
                    size={18}
                    color="#FFFFFF"
                    style={{ transform: [{ scaleX: currentLocale() === 'ar' ? -1 : 1 }] }}
                  />
                )}
              </Pressable>
            </View>
          </>
        )}
      </Screen>
      <PhotoViewer
        photos={photos}
        index={viewer !== null && viewer >= 0 ? viewer : null}
        onClose={() => setViewer(null)}
      />
    </>
  );
}

function Bubble({
  m,
  mine,
  otherId,
  showAvatar,
  avatar,
  onRetry,
  onOpenImage,
  onReport,
  onOpenProfile,
}: {
  m: Local;
  mine: boolean;
  otherId?: string;
  showAvatar: boolean;
  avatar: { file: FileRef | null; name: string } | null;
  onRetry: () => void;
  onOpenImage: () => void;
  onReport: () => void;
  onOpenProfile: () => void;
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
      {!mine && (
        <View style={styles.avatarSlot}>
          {showAvatar && avatar && (
            <Pressable
              onPress={onOpenProfile}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={avatar.name}
              accessibilityHint={t('viewProfile')}
            >
              <Avatar file={avatar.file} name={avatar.name} size={28} />
            </Pressable>
          )}
        </View>
      )}
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
          <Pressable
            onPress={m.local ? undefined : onOpenImage}
            onLongPress={!mine && !m.local ? onReport : undefined}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('common:enlargePhoto')}
          >
            <Image
              source={{ uri: m.image.url.startsWith('http') ? cdn(m.image.url, 600) : m.image.url }}
              style={styles.image}
              contentFit="cover"
            />
          </Pressable>
        ) : m.type === 'image' ? (
          <View style={styles.expired}>
            <Ionicons
              name="image-outline"
              size={18}
              color={mine ? 'rgba(255,255,255,0.8)' : colors.textMuted}
            />
            <AppText size="sm" color={mine ? 'rgba(255,255,255,0.8)' : colors.textMuted}>
              {t('imageExpired')}
            </AppText>
          </View>
        ) : (
          <AppText color={mine ? '#FFFFFF' : colors.navy}>{m.text}</AppText>
        )}
        <AppText size="xs" color={mine ? 'rgba(255,255,255,0.8)' : colors.textMuted} align="right">
          {m.local === 'sending'
            ? t('sending')
            : m.local === 'failed'
              ? t('failed')
              : `${formatTime(m.createdAt)}${seen ? ` · ${t('seen')}` : ''}`}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(1.5) },
  blockedBar: {
    alignItems: 'center',
    gap: space(1),
    padding: space(4),
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  parcel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    marginHorizontal: space(4),
    marginBottom: space(2),
    padding: space(2),
    borderRadius: radii.input,
    backgroundColor: colors.primarySoft,
  },
  typing: { paddingHorizontal: space(5), paddingBottom: space(1) },
  list: { padding: space(4), gap: space(2) },
  system: {
    alignSelf: 'center',
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radii.chip,
    backgroundColor: colors.border,
    marginVertical: space(1),
  },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2) },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSlot: { width: 28 },
  bubble: { maxWidth: '78%', padding: space(3), borderRadius: radii.card, gap: space(1) },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  other: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  image: { width: 200, height: 200, borderRadius: radii.input },
  expired: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  attachment: {
    paddingHorizontal: space(3),
    paddingTop: space(3),
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'flex-start',
  },
  attachmentImage: { width: 84, height: 84, borderRadius: radii.input },
  removeAttachment: {
    position: 'absolute',
    top: -6,
    end: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space(2),
    padding: space(3),
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  iconBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: MIN_TOUCH,
    paddingHorizontal: space(3),
    paddingVertical: space(2.5),
    borderRadius: radii.card,
    backgroundColor: colors.background,
    color: colors.navy,
    textAlign: 'auto',
  },
  send: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
