import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICING, type PricingSettings } from '@ucolis/shared';
import { AuditLogModel } from '../src/modules/admin/model';
import { ParcelModel } from '../src/modules/parcels/model';
import { migratePricing } from '../src/modules/pricing/migration';
import { AppSettingModel } from '../src/modules/settings/model';
import { createParcel, createStaff, verifiedUser } from './fixtures';
import { makeTestApp, useDatabase } from './helpers';

useDatabase();

// Barème du 29 octobre 2026, tel qu'il a pu être enregistré depuis le back-office.
const OLD_PRICING: PricingSettings = {
  ...DEFAULT_PRICING,
  baseFee: 300,
  tiers: [
    { upToKm: 100, ratePerKm: 3 },
    { upToKm: 300, ratePerKm: 2.5 },
    { upToKm: 600, ratePerKm: 2 },
    { upToKm: null, ratePerKm: 1.5 },
  ],
  weightTiers: [
    { upToKg: 30, ratePerKg: 20 },
    { upToKg: 200, ratePerKg: 8 },
    { upToKg: null, ratePerKg: 3 },
  ],
  minPrice: 300,
};

describe('migration du barème', () => {
  it("remplace le barème enregistré et recalcule seulement les annonces sans transporteur", async () => {
    const ctx = makeTestApp();
    const admin = await createStaff(ctx, 'super_admin');
    const amina = await verifiedUser(ctx);
    // Alger → Oran, 5 kg, 40 × 30 × 30 cm : 1 500 DA avec l'ancien barème, 600 DA avec le nouveau.
    const open = await createParcel(ctx, amina);
    const assigned = await createParcel(ctx, amina);
    await AppSettingModel.create({ key: 'pricing', value: OLD_PRICING });
    await ParcelModel.updateOne({ _id: open.id }, { $set: { suggestedPrice: 1500 } });
    await ParcelModel.updateOne({ _id: assigned.id }, { $set: { suggestedPrice: 1500, status: 'assigned' } });

    const result = await migratePricing('Nouveau barème');

    expect(result).toEqual({ settingReplaced: true, parcelsChecked: 1, parcelsUpdated: 1 });
    expect((await AppSettingModel.findOne({ key: 'pricing' }).lean())?.value).toEqual(DEFAULT_PRICING);
    const quote = await ctx.http().post('/api/v1/pricing/suggest').send({
      pickup: { lat: 36.77123, lng: 3.06122 },
      dropoff: { lat: 35.69874, lng: -0.63493 },
      weightKg: 5,
      dimensionsCm: { length: 40, width: 30, height: 30 },
    });
    expect(quote.body.suggestedPrice).toBe(600);

    const after = await ParcelModel.findById(open.id).lean();
    expect(after?.suggestedPrice).toBe(600);
    expect(after?.requestedPrice).toBe(open.requestedPrice);
    expect((await ParcelModel.findById(assigned.id).lean())?.suggestedPrice).toBe(1500);

    const log = await AuditLogModel.findOne({ action: 'settings.update', targetId: 'pricing' }).lean();
    expect(String(log?.actor)).toBe(admin.id);
    expect(log?.reason).toBe('Nouveau barème');
    expect(log?.before).toEqual(OLD_PRICING);
  });

  it('ne change rien sur une base déjà à jour', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    await createParcel(ctx, amina);

    expect(await migratePricing('Nouveau barème')).toEqual({ settingReplaced: false, parcelsChecked: 1, parcelsUpdated: 0 });
    expect(await AppSettingModel.countDocuments()).toBe(0);
    expect(await AuditLogModel.countDocuments()).toBe(0);
  });
});
