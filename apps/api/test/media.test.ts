import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { purgeOldMedia } from '../src/jobs/sweeps';
import { toStorageUsage } from '../src/lib/files';
import { MessageModel } from '../src/modules/conversations/model';
import { ParcelModel } from '../src/modules/parcels/model';
import { ReportModel } from '../src/modules/trust/model';
import { createParcel, verifiedUser } from './fixtures';
import { makeTestApp, useDatabase } from './helpers';

useDatabase();

const DAY = 86_400_000;
const image = (publicId: string) => ({ url: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`, publicId, kind: 'image' });

describe('ménage des anciennes images', () => {
  it('efface les photos des annonces terminées depuis 90 jours, sauf signalement ou photo partagée', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const photo = (name: string) => image(`ucolis/parcel_photo/${amina.id}/${name}`);
    const done = await createParcel(ctx, amina, { photos: [photo('old'), photo('shared')] });
    const reported = await createParcel(ctx, amina, { photos: [photo('reported')] });
    // Annonce dupliquée encore ouverte : elle réutilise un fichier de la première.
    const open = await createParcel(ctx, amina, { photos: [photo('shared')] });
    await ParcelModel.updateMany({ _id: { $in: [done.id, reported.id] } }, { status: 'cancelled' });
    await ReportModel.create({ targetType: 'parcel', targetId: reported.id, reason: 'scam' });

    expect(await purgeOldMedia(ctx.deps, ctx.services)).toBe(0);
    ctx.clock.advance(91 * DAY);
    expect(await purgeOldMedia(ctx.deps, ctx.services)).toBe(1);
    expect(ctx.files.destroyed).toEqual([`ucolis/parcel_photo/${amina.id}/old`]);
    expect((await ParcelModel.findById(done.id).lean())!.photos).toEqual([]);
    expect((await ParcelModel.findById(reported.id).lean())!.photos).toHaveLength(1);
    expect((await ParcelModel.findById(open.id).lean())!.photos).toHaveLength(1);
    expect(await purgeOldMedia(ctx.deps, ctx.services)).toBe(0);
  });

  it('retire le fichier des images de messages de plus de 180 jours, sauf conversation signalée', async () => {
    const ctx = makeTestApp();
    const [quiet, reported] = [new Types.ObjectId(), new Types.ObjectId()];
    const old = await MessageModel.create({ conversation: quiet, type: 'image', image: image('ucolis/message_image/a/m1') });
    await MessageModel.create({ conversation: reported, type: 'image', image: image('ucolis/message_image/a/m2') });
    await ReportModel.create({ targetType: 'conversation', targetId: reported, reason: 'spam' });

    ctx.clock.advance(100 * DAY);
    expect(await purgeOldMedia(ctx.deps, ctx.services)).toBe(0);
    ctx.clock.advance(81 * DAY);
    expect(await purgeOldMedia(ctx.deps, ctx.services)).toBe(1);
    expect(ctx.files.destroyed).toEqual(['ucolis/message_image/a/m1']);
    const kept = await MessageModel.findById(old._id).lean();
    expect(kept).toMatchObject({ type: 'image', image: null });
  });
});

describe('consommation Cloudinary', () => {
  it('ramène la réponse de l’Admin API au format du back-office', () => {
    expect(
      toStorageUsage({
        plan: 'Free',
        last_updated: '2026-10-20',
        credits: { usage: 7.5, limit: 25, used_percent: 30 },
        storage: { usage: 300_000_000, credits_usage: 0.3 },
        bandwidth: { usage: 4_000_000_000, credits_usage: 4 },
        transformations: { usage: 3000, credits_usage: 3 },
        objects: { usage: 1000 },
      }),
    ).toEqual({
      plan: 'Free',
      updatedAt: '2026-10-20T00:00:00.000Z',
      credits: { used: 7.5, limit: 25, percent: 30 },
      storage: { bytes: 300_000_000, credits: 0.3 },
      bandwidth: { bytes: 4_000_000_000, credits: 4 },
      transformations: { count: 3000, credits: 3 },
      objects: 1000,
    });
    expect(toStorageUsage({}).credits).toEqual({ used: 0, limit: null, percent: null });
  });

});
