// Vérification d'identité du transporteur (F5) et véhicules (1 à 5, dont un par défaut).

import { Types } from 'mongoose';
import {
  CARRIER_DOCUMENT_KINDS,
  MAX_VEHICLES,
  isOwnedUpload,
  type CarrierVerificationInput,
  type FileRef,
  type VehicleInput,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { privateDownloadUrl } from '../../lib/cloudinary';
import { AppError } from '../../lib/errors';
import { UserModel, type UserLean } from '../users/model';
import { toMe } from '../users/serializers';

/** Fichier « authenticated » servi par URL signée valable 5 minutes. */
export function signedFileUrl(deps: Deps, file: FileRef | null | undefined) {
  if (!file) return null;
  const now = Math.floor(deps.now().getTime() / 1000);
  return {
    kind: file.kind,
    url: privateDownloadUrl(deps.config.cloudinary, file.publicId, {
      resourceType: file.kind === 'pdf' ? 'raw' : 'image',
      timestamp: now,
      expiresAt: now + 300,
      format: file.kind === 'pdf' ? 'pdf' : 'jpg',
    }),
  };
}

export function createCarrierService(deps: Deps) {
  async function load(userId: string): Promise<UserLean> {
    const u = (await UserModel.findById(userId).lean()) as UserLean | null;
    if (!u) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable');
    return u;
  }

  return {
    async getVerification(userId: string) {
      const u = await load(userId);
      const cv = u.carrierVerification;
      return {
        status: cv?.status ?? 'not_submitted',
        decisionReason: cv?.decisionReason ?? null,
        submittedAt: cv?.submittedAt ?? null,
        licenseExpiresAt: cv?.licenseExpiresAt ?? null,
        insuranceExpiresAt: cv?.insuranceExpiresAt ?? null,
        documents: Object.fromEntries(
          CARRIER_DOCUMENT_KINDS.map((k) => [k, signedFileUrl(deps, cv?.documents?.[k] as FileRef | null)]),
        ),
      };
    },

    async submitVerification(userId: string, input: CarrierVerificationInput) {
      const u = await load(userId);
      if (u.carrierVerification?.status === 'pending') {
        throw new AppError(409, 'INVALID_TRANSITION', 'Dossier déjà en cours d’examen');
      }
      for (const kind of CARRIER_DOCUMENT_KINDS) {
        if (!isOwnedUpload(input.documents[kind].publicId, 'identity_doc', userId)) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Pièce invalide', {
            fields: [{ path: `documents.${kind}`, message: 'validation.required' }],
          });
        }
      }
      const updated = await UserModel.findByIdAndUpdate(
        userId,
        {
          $set: {
            'carrierVerification.status': 'pending',
            'carrierVerification.documents': input.documents,
            'carrierVerification.licenseExpiresAt': input.licenseExpiresAt,
            'carrierVerification.insuranceExpiresAt': input.insuranceExpiresAt,
            'carrierVerification.submittedAt': deps.now(),
            'carrierVerification.decisionReason': null,
            'carrierVerification.remindersSent': [],
          },
        },
        { new: true },
      ).lean();
      await deps.bus.emit('carrier.verification_submitted', { userId });
      return toMe(updated as UserLean);
    },

    async listVehicles(userId: string) {
      return toMe(await load(userId)).vehicles;
    },

    async addVehicle(userId: string, input: VehicleInput) {
      const u = await load(userId);
      const vehicles = u.vehicles ?? [];
      if (vehicles.length >= MAX_VEHICLES) {
        throw new AppError(422, 'VALIDATION_ERROR', '5 véhicules au maximum');
      }
      if (input.photo && !isOwnedUpload(input.photo.publicId, 'vehicle_photo', userId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Photo invalide');
      }
      const isDefault = vehicles.length === 0 || !!input.isDefault;
      const _id = new Types.ObjectId();
      if (isDefault) await UserModel.updateOne({ _id: userId }, { $set: { 'vehicles.$[].isDefault': false } });
      await UserModel.updateOne(
        { _id: userId },
        { $push: { vehicles: { ...input, photo: input.photo ?? null, isDefault, _id } } },
      );
      return this.listVehicles(userId);
    },

    async updateVehicle(userId: string, vehicleId: string, input: Partial<VehicleInput>) {
      const u = await load(userId);
      if (!u.vehicles?.some((v) => v._id.toString() === vehicleId)) {
        throw new AppError(404, 'NOT_FOUND', 'Véhicule introuvable');
      }
      if (input.photo && !isOwnedUpload(input.photo.publicId, 'vehicle_photo', userId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Photo invalide');
      }
      if (input.isDefault) await UserModel.updateOne({ _id: userId }, { $set: { 'vehicles.$[].isDefault': false } });
      const set = Object.fromEntries(
        Object.entries(input)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [`vehicles.$.${k}`, v]),
      );
      await UserModel.updateOne({ _id: userId, 'vehicles._id': vehicleId }, { $set: set });
      return this.listVehicles(userId);
    },

    async deleteVehicle(userId: string, vehicleId: string) {
      const u = await load(userId);
      const target = u.vehicles?.find((v) => v._id.toString() === vehicleId);
      if (!target) throw new AppError(404, 'NOT_FOUND', 'Véhicule introuvable');
      await UserModel.updateOne({ _id: userId }, { $pull: { vehicles: { _id: target._id } } });
      if (target.isDefault) {
        const rest = (await load(userId)).vehicles ?? [];
        if (rest[0]) await UserModel.updateOne({ _id: userId, 'vehicles._id': rest[0]._id }, { $set: { 'vehicles.$.isDefault': true } });
      }
      return this.listVehicles(userId);
    },
  };
}

export type CarrierService = ReturnType<typeof createCarrierService>;
