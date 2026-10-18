// Centre de notifications et push. Appelé uniquement par les abonnés aux événements de domaine :
// les services métier n'envoient jamais de notification directement.

import {
  NOTIFICATION_TYPES,
  deepLinkFor,
  formatNotificationParams,
  formatPrice,
  notificationKeys,
  shouldPush,
  translate,
  type Counters,
  type Locale,
  type NotificationDto,
  type NotificationType,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { paginate } from '../../lib/http';
import { ConversationModel } from '../conversations/model';
import { PushTokenModel } from '../push/model';
import { UserModel } from '../users/model';
import { NotificationModel, type NotificationLean } from './model';

export interface NotifyInput {
  type: NotificationType;
  to: string;
  params?: Record<string, string | number>;
  data?: NotificationDto['data'];
  /** Pas de push (ex. conversation ouverte à l'écran ou en sourdine). */
  skipPush?: boolean;
  /** Regroupement des push (conversation). */
  group?: string;
}

export function toNotificationDto(n: NotificationLean): NotificationDto {
  const data = (n.data ?? {}) as NotificationDto['data'];
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v)) as NotificationDto['data'];
  return {
    id: n._id.toString(),
    type: n.type,
    category: n.category,
    titleKey: n.titleKey,
    bodyKey: n.bodyKey,
    params: (n.params ?? {}) as Record<string, string | number>,
    data: clean,
    link: (data as { url?: string | null }).url ?? deepLinkFor(n.type as NotificationType, clean as Record<string, string>),
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export function createNotificationService(deps: Deps) {
  async function counters(userId: string): Promise<Counters> {
    const [unreadNotifications, convs] = await Promise.all([
      NotificationModel.countDocuments({ recipient: userId, readAt: null }),
      ConversationModel.find({ participants: userId }, { unread: 1 }).lean(),
    ]);
    const unreadMessages = convs.reduce((sum, c) => {
      const unread = c.unread as unknown as Record<string, number> | undefined;
      return sum + (unread?.[userId] ?? 0);
    }, 0);
    return { unreadMessages, unreadNotifications };
  }

  async function pushCounters(userId: string) {
    deps.realtime.toUser(userId, 'counters', await counters(userId));
  }

  return {
    counters,
    pushCounters,

    async notify(input: NotifyInput) {
      const def = NOTIFICATION_TYPES[input.type];
      const user = await UserModel.findById(input.to, { preferences: 1, status: 1 }).lean();
      if (!user || user.status === 'deleted') return null;
      // Messages : une seule notification non lue par conversation, mise à jour à chaque message.
      const collapsed =
        input.type === 'new_message' && input.data?.conversationId
          ? await NotificationModel.findOneAndUpdate(
              {
                recipient: input.to,
                type: 'new_message',
                readAt: null,
                'data.conversationId': input.data.conversationId,
              },
              { $set: { params: input.params ?? {}, createdAt: deps.now() } },
              { new: true, timestamps: false },
            )
          : null;
      const doc =
        collapsed ??
        (await NotificationModel.create({
          recipient: input.to,
          type: input.type,
          category: def.category,
          ...notificationKeys(input.type),
          params: input.params ?? {},
          data: input.data ?? {},
        }));
      const dto = toNotificationDto(doc.toObject() as NotificationLean);
      deps.realtime.toUser(input.to, 'notification:new', dto);
      await pushCounters(input.to);

      const prefs = Object.fromEntries(
        Object.entries((user.preferences?.notifications as Record<string, boolean> | undefined) ?? {}),
      );
      if (input.skipPush || !shouldPush(input.type, prefs)) return dto;
      const tokens = await PushTokenModel.find({ user: input.to }, { token: 1 }).lean();
      if (!tokens.length) return dto;
      // Le serveur construit le push dans la langue enregistrée du destinataire.
      const locale: Locale = user.preferences?.language ?? 'fr';
      const params = formatNotificationParams(input.params ?? {}, locale, formatPrice);
      await deps.push.send(
        tokens.map((t) => ({
          to: t.token,
          title: translate(locale, dto.titleKey, params),
          body: translate(locale, dto.bodyKey, params),
          data: { url: dto.link, notificationId: dto.id, type: input.type },
          group: input.group,
        })),
      );
      return dto;
    },

    async list(userId: string, page: number, limit: number) {
      const filter = { recipient: userId };
      const [total, items] = await Promise.all([
        NotificationModel.countDocuments(filter),
        NotificationModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ]);
      return paginate((items as NotificationLean[]).map(toNotificationDto), page, limit, total);
    },

    async markRead(userId: string, id: string) {
      const res = await NotificationModel.updateOne({ _id: id, recipient: userId }, { readAt: deps.now() });
      if (!res.matchedCount) throw new AppError(404, 'NOT_FOUND', 'Notification introuvable');
      await pushCounters(userId);
    },

    async markAllRead(userId: string) {
      await NotificationModel.updateMany({ recipient: userId, readAt: null }, { readAt: deps.now() });
      await pushCounters(userId);
    },

    async markConversationRead(userId: string, conversationId: string) {
      await NotificationModel.updateMany(
        { recipient: userId, type: 'new_message', readAt: null, 'data.conversationId': conversationId },
        { readAt: deps.now() },
      );
      await pushCounters(userId);
    },

    async remove(userId: string, id?: string) {
      await NotificationModel.deleteMany({ recipient: userId, ...(id ? { _id: id } : {}) });
      await pushCounters(userId);
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
