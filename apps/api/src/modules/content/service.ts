// Contenus (F17) : FAQ, CGU et confidentialité, en français et en arabe, versionnés.
// Publier une nouvelle version des CGU oblige chaque utilisateur à l'accepter à sa prochaine ouverture.
// Diffusions du staff : message bilingue vers un segment, immédiat ou programmé.

import type { FilterQuery } from 'mongoose';
import { LOCALES, contentLocale, type ContentLocale, type Locale } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { AppSettingModel } from '../settings/model';
import { UserModel, type UserLean } from '../users/model';
import { BroadcastModel, ContentModel, type BroadcastLean, type ContentKey } from './model';

export interface BroadcastInput {
  title: { fr: string; ar: string };
  body: { fr: string; ar: string };
  segment: { kind: 'all' | 'carriers' | 'senders' | 'pros' | 'wilaya'; wilayaCode?: string | null };
  link?: string | null;
  scheduledAt?: Date | null;
}

export function segmentFilter(segment: BroadcastInput['segment']): FilterQuery<UserLean> {
  const base: FilterQuery<UserLean> = { status: 'active' };
  switch (segment.kind) {
    case 'carriers':
      return { ...base, intent: { $in: ['carrier', 'both'] } };
    case 'senders':
      return { ...base, intent: { $in: ['sender', 'both'] } };
    case 'pros':
      return { ...base, 'pro.status': 'approved' };
    case 'wilaya':
      return { ...base, wilayaCode: segment.wilayaCode };
    default:
      return base;
  }
}

export function createContentService(deps: Deps) {
  return {
    async getPublished(key: ContentKey, locale: ContentLocale) {
      const doc = await ContentModel.findOne({ key, locale }).lean();
      if (!doc || !doc.publishedAt) {
        // Repli sur l'autre langue si la traduction n'est pas encore publiée.
        const other = await ContentModel.findOne({ key, publishedAt: { $ne: null } }).lean();
        if (!other) throw new AppError(404, 'NOT_FOUND', 'Contenu non publié');
        return { key, locale: other.locale, body: other.body, version: other.version, publishedAt: other.publishedAt };
      }
      return { key, locale, body: doc.body, version: doc.version, publishedAt: doc.publishedAt };
    },

    async listForStaff() {
      const docs = await ContentModel.find().lean();
      return {
        items: docs.map((d) => ({
          key: d.key,
          locale: d.locale,
          body: d.body,
          draft: d.draft,
          version: d.version,
          publishedAt: d.publishedAt,
          updatedAt: (d as unknown as { updatedAt: Date }).updatedAt,
        })),
      };
    },

    async saveDraft(key: ContentKey, locale: ContentLocale, draft: string, staffId: string) {
      await ContentModel.updateOne({ key, locale }, { $set: { draft, updatedBy: staffId } }, { upsert: true });
    },

    async publish(key: ContentKey, locale: ContentLocale, staffId: string) {
      const doc = await ContentModel.findOne({ key, locale });
      if (!doc?.draft) throw new AppError(409, 'INVALID_TRANSITION', 'Aucun brouillon à publier');
      doc.body = doc.draft;
      doc.draft = null;
      doc.version += 1;
      doc.publishedAt = deps.now();
      doc.updatedBy = staffId as never;
      await doc.save();
      if (key === 'terms') {
        // Nouvelle version des CGU : réglage termsVersion mis à jour, utilisateurs prévenus.
        const version = deps.now().toISOString().slice(0, 10) + `.${doc.version}`;
        await AppSettingModel.updateOne({ key: 'termsVersion' }, { $set: { value: version, updatedBy: staffId } }, { upsert: true });
        await deps.bus.emit('terms.published', { version });
      }
      return { key, locale, version: doc.version, publishedAt: doc.publishedAt };
    },

    // --- Diffusions -------------------------------------------------------------------------------

    previewCount: (segment: BroadcastInput['segment']) => UserModel.countDocuments(segmentFilter(segment)),

    async createBroadcast(input: BroadcastInput, staffId: string) {
      const doc = await BroadcastModel.create({ ...input, scheduledAt: input.scheduledAt ?? null, createdBy: staffId });
      if (!input.scheduledAt || input.scheduledAt <= deps.now()) await this.sendBroadcast(doc.toObject() as BroadcastLean);
      return (await BroadcastModel.findById(doc._id).lean()) as BroadcastLean;
    },

    async sendBroadcast(b: BroadcastLean) {
      const claimed = await BroadcastModel.updateOne({ _id: b._id, sentAt: null }, { sentAt: deps.now() });
      if (!claimed.modifiedCount) return 0;
      let count = 0;
      const cursor = UserModel.find(segmentFilter({ kind: b.segment!.kind, wilayaCode: b.segment!.wilayaCode }), { _id: 1, preferences: 1 }).cursor();
      for await (const u of cursor) {
        const locale = contentLocale((u.preferences?.language as Locale | undefined) ?? 'fr');
        await deps.bus.emit('broadcast.deliver', {
          userId: u._id.toString(),
          title: b.title?.[locale] || b.title?.fr || '',
          body: b.body?.[locale] || b.body?.fr || '',
          link: b.link ?? null,
        });
        count++;
      }
      await BroadcastModel.updateOne({ _id: b._id }, { recipients: count });
      return count;
    },

    async listBroadcasts() {
      const items = await BroadcastModel.find().sort({ createdAt: -1 }).limit(100).lean();
      return { items };
    },

    /** Balayage : diffusions programmées arrivées à échéance. */
    async sendDue() {
      const due = (await BroadcastModel.find({ sentAt: null, scheduledAt: { $lte: deps.now() } }).lean()) as BroadcastLean[];
      let total = 0;
      for (const b of due) total += await this.sendBroadcast(b);
      return total;
    },
  };
}

export type ContentService = ReturnType<typeof createContentService>;

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);
