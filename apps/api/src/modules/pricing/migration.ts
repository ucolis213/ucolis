// Passage à un nouveau barème par défaut (shared/pricing) : un barème enregistré en base primerait sur lui, il
// est donc remplacé (et journalisé), puis le prix suggéré des annonces encore sans transporteur est recalculé.
// Le prix demandé par l'expéditeur et les offres en cours ne changent pas.

import { isDeepStrictEqual } from 'node:util';
import { DEFAULT_PRICING, PUBLIC_PARCEL_STATUSES, suggestPrice, type PricingSettings } from '@ucolis/shared';
import { AuditLogModel, StaffModel } from '../admin/model';
import { ParcelModel } from '../parcels/model';
import { AppSettingModel } from '../settings/model';

export interface PricingMigrationResult {
  /** Le barème enregistré en base différait et a été remplacé. */
  settingReplaced: boolean;
  parcelsChecked: number;
  parcelsUpdated: number;
}

export async function migratePricing(reason: string, pricing: PricingSettings = DEFAULT_PRICING): Promise<PricingMigrationResult> {
  const row = await AppSettingModel.findOne({ key: 'pricing' }).lean();
  // Sans ligne en base, le barème par défaut s'applique déjà.
  const settingReplaced = !!row && !isDeepStrictEqual(row.value, pricing);
  if (settingReplaced) {
    await AppSettingModel.updateOne({ key: 'pricing' }, { $set: { value: pricing, updatedBy: null } });
    // Le journal exige un auteur : la modification est attribuée au super-administrateur, s'il existe.
    const admin = await StaffModel.findOne({ role: 'super_admin' }, { _id: 1 }).lean();
    if (admin) {
      await AuditLogModel.create({
        actor: admin._id,
        action: 'settings.update',
        targetType: 'setting',
        targetId: 'pricing',
        reason,
        before: row.value,
        after: pricing,
      });
    }
  }

  const parcels = await ParcelModel.find(
    { status: { $in: PUBLIC_PARCEL_STATUSES } },
    { distanceKm: 1, weightKg: 1, volumeM3: 1, fragile: 1, suggestedPrice: 1 },
  ).lean();
  const updates = parcels.flatMap((p) => {
    const next = suggestPrice(
      { distanceKm: p.distanceKm, weightKg: p.weightKg ?? 0, volumeM3: p.volumeM3 ?? 0, fragile: !!p.fragile },
      pricing,
    );
    return next === p.suggestedPrice ? [] : [{ updateOne: { filter: { _id: p._id }, update: { $set: { suggestedPrice: next } } } }];
  });
  if (updates.length) await ParcelModel.bulkWrite(updates);

  return { settingReplaced, parcelsChecked: parcels.length, parcelsUpdated: updates.length };
}
