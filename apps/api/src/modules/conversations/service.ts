// Messagerie (F13) : une conversation par paire d'utilisateurs et par colis, plus une conversation
// générale par paire. Envoi optimiste dédoublonné par clientId. Aucun échange avant l'acceptation d'une
// offre entre les deux : la négociation se fait uniquement sur le prix.

import { Types } from 'mongoose';
import type { ConversationDto, FileRef, MessageDto } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { LIMITS, consume } from '../../lib/rateLimit';
import { isBlockedBetween } from '../me/service';
import { OfferModel } from '../offers/model';
import { ParcelModel } from '../parcels/model';
import { UserModel, type UserLean } from '../users/model';
import { toUserSummary } from '../users/serializers';
import { ConversationModel, MessageModel, type ConversationLean, type MessageLean } from './model';

export const MESSAGES_PAGE = 30;
export const pairKeyOf = (a: string, b: string) => [a, b].sort().join(':');
export const conversationRoom = (id: string) => `conversation:${id}`;

export function toMessageDto(m: MessageLean): MessageDto {
  return {
    id: m._id.toString(),
    conversationId: m.conversation.toString(),
    authorId: m.author ? m.author.toString() : null,
    type: m.type,
    text: m.deletedByStaff ? null : (m.text ?? null),
    image: m.deletedByStaff ? null : ((m.image as FileRef | null) ?? null),
    systemKey: m.systemKey ?? null,
    systemParams: (m.systemParams as Record<string, string | number> | null) ?? null,
    clientId: m.clientId ?? null,
    readBy: (m.readBy ?? []).map((r) => r.user!.toString()),
    deleted: !!m.deletedByStaff,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Clé d'une livraison acceptée entre deux personnes, sur un colis précis ou sur n'importe quel colis. */
const dealKey = (pairKey: string, parcelId: string | null) => (parcelId ? `${pairKey}|${parcelId}` : pairKey);

/**
 * Livraisons acceptées entre userId et chacun des autres : offre acceptée, ou acceptée puis abandonnée par le
 * transporteur (la livraison a bien été acceptée). Renvoie les clés dealKey, avec et sans colis.
 */
async function dealsWith(userId: string, others: string[]): Promise<Set<string>> {
  const offers = await OfferModel.find(
    {
      carrier: { $in: [userId, ...others] },
      $or: [{ status: 'accepted' }, { withdrawnAfterAcceptAt: { $ne: null } }],
    },
    { parcel: 1, carrier: 1 },
  ).lean();
  const parcels = await ParcelModel.find(
    { _id: { $in: offers.map((o) => o.parcel) } },
    { sender: 1 },
  ).lean();
  const senderOf = new Map(parcels.map((p) => [p._id.toString(), p.sender.toString()]));
  const wanted = new Set(others);
  const keys = new Set<string>();
  for (const o of offers) {
    const parcelId = o.parcel.toString();
    const sender = senderOf.get(parcelId);
    const carrier = o.carrier.toString();
    if (!sender) continue;
    // Seulement les paires userId ↔ un des autres.
    const other = sender === userId ? carrier : carrier === userId ? sender : null;
    if (!other || !wanted.has(other)) continue;
    const pairKey = pairKeyOf(sender, carrier);
    keys.add(dealKey(pairKey, null));
    keys.add(dealKey(pairKey, parcelId));
  }
  return keys;
}

/** Vrai si la messagerie est permise entre a et b (sur ce colis, ou en conversation générale). */
export async function canMessage(a: string, b: string, parcelId: string | null): Promise<boolean> {
  return (await dealsWith(a, [b])).has(dealKey(pairKeyOf(a, b), parcelId));
}

const lockedError = () =>
  new AppError(403, 'MESSAGING_LOCKED', 'Messagerie ouverte après l’acceptation d’une offre');

export interface SendInput {
  clientId: string;
  type: 'text' | 'image';
  text?: string;
  image?: FileRef;
}

export function createConversationService(deps: Deps) {
  const sendLimiter = deps.limiters('messages', LIMITS.messages);
  const newConvLimiter = deps.limiters('conversations', LIMITS.conversationsPerDay);

  async function loadFor(userId: string, id: string): Promise<ConversationLean> {
    const c = (await ConversationModel.findById(id).lean()) as ConversationLean | null;
    if (!c || !c.participants.some((p) => p.toString() === userId)) {
      throw new AppError(404, 'NOT_FOUND', 'Conversation introuvable');
    }
    return c;
  }

  const otherOf = (c: ConversationLean, userId: string) =>
    c.participants.find((p) => p.toString() !== userId)!.toString();

  async function toDtos(convs: ConversationLean[], userId: string): Promise<ConversationDto[]> {
    const others = convs.map((c) => otherOf(c, userId));
    const [users, parcels, me, deals] = await Promise.all([
      UserModel.find({ _id: { $in: others } }).lean(),
      ParcelModel.find(
        { _id: { $in: convs.map((c) => c.parcel).filter(Boolean) } },
        { title: 1, status: 1, reference: 1 },
      ).lean(),
      UserModel.findById(userId, { blockedUsers: 1 }).lean(),
      dealsWith(userId, others),
    ]);
    const u = new Map(users.map((x) => [x._id.toString(), x as UserLean]));
    const p = new Map(parcels.map((x) => [x._id.toString(), x]));
    const iBlock = new Set((me?.blockedUsers ?? []).map(String));
    // Conversations antérieures au stockage des paramètres : on les relit sur le dernier message système.
    const legacy = convs.filter((c) => c.lastMessage?.type === 'system' && !c.lastMessage.params);
    const legacyParams = new Map<string, Record<string, string | number>>();
    for (const c of legacy) {
      const m = await MessageModel.findOne({ conversation: c._id, type: 'system' }, { systemParams: 1 })
        .sort({ createdAt: -1 })
        .lean();
      if (m?.systemParams) legacyParams.set(c._id.toString(), m.systemParams as Record<string, string | number>);
    }
    return convs.map((c) => {
      const parcel = c.parcel ? p.get(c.parcel.toString()) : null;
      const unread = c.unread as unknown as Record<string, number> | undefined;
      const other = u.get(otherOf(c, userId))!;
      const blockedByMe = iBlock.has(other._id.toString());
      const blocksMe = (other.blockedUsers ?? []).some((b) => b.toString() === userId);
      const locked = !deals.has(dealKey(c.pairKey, c.parcel ? c.parcel.toString() : null));
      return {
        id: c._id.toString(),
        other: toUserSummary(other),
        parcel: parcel
          ? {
              id: parcel._id.toString(),
              title: parcel.title,
              status: parcel.status,
              reference: parcel.reference,
            }
          : null,
        lastMessage: {
          text: c.lastMessage?.text ?? null,
          type: c.lastMessage?.type ?? null,
          authorId: c.lastMessage?.author ? c.lastMessage.author.toString() : null,
          at: c.lastMessage?.at ? c.lastMessage.at.toISOString() : null,
          params:
            (c.lastMessage?.params as Record<string, string | number> | null) ??
            legacyParams.get(c._id.toString()) ??
            null,
        },
        unread: unread?.[userId] ?? 0,
        muted: (c.mutedBy ?? []).some((m) => m.toString() === userId),
        blockedByMe,
        locked,
        canSend: !blockedByMe && !blocksMe && !locked,
        updatedAt: c.updatedAt.toISOString(),
      };
    });
  }

  /** Crée la conversation ou renvoie l'existante (unique par paire et par colis). */
  async function ensure(a: string, b: string, parcelId: string | null, createdBy: string | null) {
    const pairKey = pairKeyOf(a, b);
    const parcel = parcelId ? new Types.ObjectId(parcelId) : null;
    const existing = await ConversationModel.findOne({ pairKey, parcel }).lean();
    if (existing) return { conversation: existing as ConversationLean, created: false };
    try {
      const created = await ConversationModel.create({
        participants: [a, b].sort().map((id) => new Types.ObjectId(id)),
        parcel,
        pairKey,
        createdBy,
      });
      return {
        conversation: created.toObject({ flattenMaps: true }) as unknown as ConversationLean,
        created: true,
      };
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      return {
        conversation: (await ConversationModel.findOne({
          pairKey,
          parcel,
        }).lean()) as ConversationLean,
        created: false,
      };
    }
  }

  async function store(c: ConversationLean, authorId: string | null, data: Partial<MessageLean>) {
    const now = deps.now();
    const message = (
      await MessageModel.create({ conversation: c._id, author: authorId, ...data })
    ).toObject() as MessageLean;
    const recipients = c.participants.map(String).filter((p) => p !== authorId);
    const inc = Object.fromEntries(recipients.map((r) => [`unread.${r}`, 1]));
    const preview = data.type === 'image' ? '📷' : (data.text ?? data.systemKey ?? '');
    await ConversationModel.updateOne(
      { _id: c._id },
      {
        $set: {
          lastMessage: {
            text: preview.slice(0, 120),
            type: data.type,
            author: authorId,
            params: data.systemParams ?? null,
            at: now,
          },
          deletedFor: [],
        },
        $inc: inc,
      },
    );
    const dto = toMessageDto(message);
    deps.realtime.toRoom(conversationRoom(c._id.toString()), 'message:new', dto);
    for (const r of recipients) deps.realtime.toUser(r, 'message:new', dto);
    await deps.bus.emit('message.created', {
      messageId: dto.id,
      conversationId: c._id.toString(),
      authorId,
      recipients,
      preview: preview.slice(0, 120),
      system: data.type === 'system',
    });
    return dto;
  }

  return {
    ensure,
    toDtos,

    async find(a: string, b: string, parcelId: string | null) {
      const c = await ConversationModel.findOne(
        { pairKey: pairKeyOf(a, b), parcel: parcelId ? new Types.ObjectId(parcelId) : null },
        { _id: 1 },
      ).lean();
      return c?._id.toString() ?? null;
    },

    async open(userId: string, otherId: string, parcelId?: string) {
      if (userId === otherId)
        throw new AppError(400, 'VALIDATION_ERROR', 'Conversation avec soi-même');
      const other = await UserModel.findById(otherId, { status: 1 }).lean();
      if (!other || other.status === 'deleted')
        throw new AppError(404, 'NOT_FOUND', 'Utilisateur introuvable');
      if (await isBlockedBetween(userId, otherId))
        throw new AppError(403, 'BLOCKED', 'Utilisateur bloqué');
      if (parcelId && !(await ParcelModel.exists({ _id: parcelId })))
        throw new AppError(404, 'NOT_FOUND', 'Colis introuvable');
      // Conversation de colis : offre acceptée sur ce colis ; « Contacter » : une livraison acceptée ensemble.
      if (!(await canMessage(userId, otherId, parcelId ?? null))) throw lockedError();
      const pairKey = pairKeyOf(userId, otherId);
      const exists = await ConversationModel.exists({ pairKey, parcel: parcelId ?? null });
      if (!exists && !parcelId) await consume(newConvLimiter, userId);
      const { conversation } = await ensure(userId, otherId, parcelId ?? null, userId);
      // Rouverte volontairement (« Message », « Contacter ») : elle reprend sa place dans ma liste.
      if (conversation.deletedFor?.some((d) => d.toString() === userId)) {
        await ConversationModel.updateOne(
          { _id: conversation._id },
          { $pull: { deletedFor: new Types.ObjectId(userId) } },
        );
      }
      return (await toDtos([conversation], userId))[0]!;
    },

    async list(userId: string) {
      const convs = (await ConversationModel.find({
        participants: userId,
        deletedFor: { $ne: new Types.ObjectId(userId) },
        'lastMessage.at': { $ne: null },
      })
        .sort({ 'lastMessage.at': -1 })
        .limit(100)
        .lean()) as ConversationLean[];
      return { items: await toDtos(convs, userId) };
    },

    async get(userId: string, id: string) {
      return (await toDtos([await loadFor(userId, id)], userId))[0]!;
    },

    async messages(userId: string, id: string, before?: string) {
      await loadFor(userId, id);
      const filter: Record<string, unknown> = { conversation: id };
      if (before) {
        const pivot = await MessageModel.findById(before, { createdAt: 1 }).lean();
        if (pivot) filter.createdAt = { $lt: pivot.createdAt };
      }
      const items = (await MessageModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(MESSAGES_PAGE + 1)
        .lean()) as MessageLean[];
      return {
        items: items.slice(0, MESSAGES_PAGE).map(toMessageDto),
        hasMore: items.length > MESSAGES_PAGE,
      };
    },

    async send(userId: string, id: string, input: SendInput) {
      const c = await loadFor(userId, id);
      const existing = await MessageModel.findOne({
        conversation: id,
        clientId: input.clientId,
      }).lean();
      if (existing) return toMessageDto(existing as MessageLean);
      await consume(sendLimiter, userId);
      if (await isBlockedBetween(userId, otherOf(c, userId))) {
        throw new AppError(403, 'BLOCKED', 'Utilisateur bloqué');
      }
      // Conversation ouverte avant cette règle (« Poser une question ») : lecture seule.
      if (!(await canMessage(userId, otherOf(c, userId), c.parcel ? c.parcel.toString() : null)))
        throw lockedError();
      try {
        return await store(c, userId, {
          type: input.type,
          text: input.type === 'text' ? (input.text ?? '').trim() : null,
          image: input.type === 'image' ? (input.image ?? null) : null,
          clientId: input.clientId,
        } as Partial<MessageLean>);
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
        const dup = await MessageModel.findOne({
          conversation: id,
          clientId: input.clientId,
        }).lean();
        return toMessageDto(dup as MessageLean);
      }
    },

    /** Message système automatique (ex. « Offre acceptée à 3 250 DA »), traduit côté client. */
    async system(
      conversationId: string,
      systemKey: string,
      systemParams: Record<string, string | number> = {},
    ) {
      const c = (await ConversationModel.findById(
        conversationId,
      ).lean()) as ConversationLean | null;
      if (!c) return null;
      return store(c, null, { type: 'system', systemKey, systemParams } as Partial<MessageLean>);
    },

    async read(userId: string, id: string) {
      await loadFor(userId, id);
      const now = deps.now();
      await MessageModel.updateMany(
        {
          conversation: id,
          author: { $ne: new Types.ObjectId(userId) },
          'readBy.user': { $ne: new Types.ObjectId(userId) },
        },
        { $push: { readBy: { user: userId, at: now } } },
      );
      await ConversationModel.updateOne({ _id: id }, { $set: { [`unread.${userId}`]: 0 } });
      deps.realtime.toRoom(conversationRoom(id), 'messages:read', {
        conversationId: id,
        userId,
        at: now.toISOString(),
      });
      await deps.bus.emit('conversation.read', { conversationId: id, userId });
    },

    async mute(userId: string, id: string, muted: boolean) {
      await loadFor(userId, id);
      await ConversationModel.updateOne(
        { _id: id },
        muted
          ? { $addToSet: { mutedBy: new Types.ObjectId(userId) } }
          : { $pull: { mutedBy: new Types.ObjectId(userId) } },
      );
      return this.get(userId, id);
    },

    /**
     * Supprime la conversation de ma liste, pour moi seul : l'autre participant et le staff la gardent
     * (signalements, litiges). Elle revient, historique compris, au prochain message.
     */
    async hide(userId: string, id: string) {
      await loadFor(userId, id);
      await ConversationModel.updateOne(
        { _id: id },
        { $addToSet: { deletedFor: new Types.ObjectId(userId) }, $set: { [`unread.${userId}`]: 0 } },
      );
      // Sans accusé « Vu » : seuls les badges et les notifications de message sont remis à zéro.
      await deps.bus.emit('conversation.read', { conversationId: id, userId });
    },

    async isMuted(userId: string, conversationId: string) {
      return !!(await ConversationModel.exists({
        _id: conversationId,
        mutedBy: new Types.ObjectId(userId),
      }));
    },

    assertParticipant: loadFor,
  };
}

export type ConversationService = ReturnType<typeof createConversationService>;
