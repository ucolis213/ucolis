// Statut professionnel (F4). none → pending → approved | rejected ; approved → revoked (motif).
// accountType n'est jamais écrit : il est calculé à partir de pro.status. Un compte déjà validé qui
// change sa raison sociale ou son RC dépose un nouveau dossier ; il reste approved jusqu'à la décision.

import type { Request } from 'express';
import { isOwnedUpload, type FileRef, type ProApplicationInput } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { signedFileUrl } from '../carrier/service';
import type { Claims } from '../admin/claims';
import { adminUserRow, canSeePii } from '../admin/usersAdmin';
import { UserModel, type UserLean } from '../users/model';
import { toMe } from '../users/serializers';

interface Application {
  companyName: string;
  legalForm: string;
  rcNumber: string;
  nif: string;
  nis: string | null;
  address: string;
  wilayaCode: string;
  commune: string;
  logo: FileRef | null;
  documents: { kind: string; file: FileRef }[];
  submittedAt: Date;
}

function toApplication(input: ProApplicationInput, now: Date): Application {
  return {
    companyName: input.companyName,
    legalForm: input.legalForm,
    rcNumber: input.rcNumber,
    nif: input.nif,
    nis: input.nis ?? null,
    address: input.address,
    wilayaCode: input.place.wilayaCode,
    commune: input.place.commune,
    logo: input.logo ?? null,
    documents: [
      { kind: 'rc', file: input.rcDocument },
      { kind: 'nif', file: input.nifDocument },
    ],
    submittedAt: now,
  };
}

const applicationOf = (u: UserLean): Application | null => {
  const pending = u.pro?.pendingApplication as Application | null | undefined;
  if (pending) return pending;
  if (!u.pro || u.pro.status === 'none') return null;
  return {
    companyName: u.pro.companyName ?? '',
    legalForm: u.pro.legalForm ?? '',
    rcNumber: u.pro.rcNumber ?? '',
    nif: u.pro.nif ?? '',
    nis: u.pro.nis ?? null,
    address: u.pro.address ?? '',
    wilayaCode: u.pro.wilayaCode ?? '',
    commune: u.pro.commune ?? '',
    logo: (u.pro.logo as FileRef | null) ?? null,
    documents: (u.pro.documents ?? []) as { kind: string; file: FileRef }[],
    submittedAt: u.pro.submittedAt as Date,
  };
};

export function createProService(deps: Deps) {
  async function load(userId: string) {
    const u = (await UserModel.findById(userId).lean()) as UserLean | null;
    if (!u) throw new AppError(404, 'NOT_FOUND', 'Utilisateur introuvable');
    return u;
  }

  const withSignedDocs = (a: Application | null) =>
    a ? { ...a, documents: a.documents.map((d) => ({ kind: d.kind, file: signedFileUrl(deps, d.file) })) } : null;

  return {
    async get(userId: string) {
      const u = await load(userId);
      return {
        status: u.pro?.status ?? 'none',
        decisionReason: u.pro?.decisionReason ?? null,
        underReview: u.pro?.status === 'pending' || !!u.pro?.pendingApplication,
        application: withSignedDocs(applicationOf(u)),
      };
    },

    async submit(userId: string, input: ProApplicationInput) {
      const u = await load(userId);
      const status = u.pro?.status ?? 'none';
      // Pendant l'examen, le dossier est en lecture seule.
      if (status === 'pending' || u.pro?.pendingApplication) {
        throw new AppError(409, 'INVALID_TRANSITION', 'Dossier en cours d’examen');
      }
      for (const doc of [input.rcDocument, input.nifDocument]) {
        if (!isOwnedUpload(doc.publicId, 'pro_doc', userId)) throw new AppError(400, 'VALIDATION_ERROR', 'Justificatif invalide');
      }
      if (input.logo && !isOwnedUpload(input.logo.publicId, 'avatar', userId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Logo invalide');
      }
      const app = toApplication(input, deps.now());
      const set: Record<string, unknown> =
        status === 'approved'
          ? { 'pro.pendingApplication': app }
          : {
              'pro.status': 'pending',
              'pro.companyName': app.companyName,
              'pro.legalForm': app.legalForm,
              'pro.rcNumber': app.rcNumber,
              'pro.nif': app.nif,
              'pro.nis': app.nis,
              'pro.address': app.address,
              'pro.wilayaCode': app.wilayaCode,
              'pro.commune': app.commune,
              'pro.logo': app.logo,
              'pro.documents': app.documents,
              'pro.submittedAt': app.submittedAt,
              'pro.decisionReason': null,
            };
      const updated = await UserModel.findByIdAndUpdate(userId, { $set: set }, { new: true }).lean();
      return toMe(updated as UserLean);
    },

    // --- Staff ------------------------------------------------------------------------------------

    async queue(claims: Claims) {
      const users = (await UserModel.find({ $or: [{ 'pro.status': 'pending' }, { 'pro.pendingApplication': { $ne: null } }] })
        .sort({ 'pro.submittedAt': 1 })
        .limit(200)
        .lean()) as UserLean[];
      const claimMap = await claims.map('pro', users.map((u) => u._id.toString()));
      return {
        items: users.map((u) => {
          const a = applicationOf(u)!;
          return {
            userId: u._id.toString(),
            companyName: a.companyName,
            legalForm: a.legalForm,
            wilayaCode: a.wilayaCode,
            submittedAt: a.submittedAt,
            change: u.pro?.status === 'approved',
            claim: claimMap.get(u._id.toString()) ?? null,
          };
        }),
      };
    },

    async detail(req: Request, userId: string, claims: Claims) {
      const u = await load(userId);
      await audit(req, { action: 'pro.view_documents', targetType: 'user', targetId: userId });
      return {
        user: adminUserRow(u, canSeePii(req.staff!)),
        status: u.pro?.status ?? 'none',
        change: !!u.pro?.pendingApplication,
        current: u.pro?.status === 'approved' ? { companyName: u.pro.companyName, rcNumber: u.pro.rcNumber } : null,
        application: withSignedDocs(applicationOf(u)),
        decisionReason: u.pro?.decisionReason ?? null,
        claim: (await claims.map('pro', [userId])).get(userId) ?? null,
      };
    },

    async decide(req: Request, userId: string, decision: 'approve' | 'reject', reason: string | undefined, claims: Claims) {
      const staffId = req.staff!.id;
      await claims.assertFree('pro', userId, staffId);
      const u = await load(userId);
      const pending = u.pro?.pendingApplication as Application | null;
      const now = deps.now();
      const review = { 'pro.reviewedAt': now, 'pro.reviewedBy': staffId };
      if (pending) {
        // Nouveau dossier d'un compte validé : le statut reste approved quoi qu'il arrive.
        const set =
          decision === 'approve'
            ? {
                'pro.companyName': pending.companyName,
                'pro.legalForm': pending.legalForm,
                'pro.rcNumber': pending.rcNumber,
                'pro.nif': pending.nif,
                'pro.nis': pending.nis,
                'pro.address': pending.address,
                'pro.wilayaCode': pending.wilayaCode,
                'pro.commune': pending.commune,
                'pro.logo': pending.logo,
                'pro.documents': pending.documents,
                'pro.submittedAt': pending.submittedAt,
                'pro.decisionReason': null,
              }
            : { 'pro.decisionReason': reason };
        await UserModel.updateOne({ _id: userId }, { $set: { ...set, ...review, 'pro.pendingApplication': null } });
      } else {
        const res = await UserModel.updateOne(
          { _id: userId, 'pro.status': 'pending' },
          { $set: { 'pro.status': decision === 'approve' ? 'approved' : 'rejected', 'pro.decisionReason': decision === 'reject' ? reason : null, ...review } },
        );
        if (!res.modifiedCount) throw new AppError(409, 'INVALID_TRANSITION', 'Dossier non en attente');
      }
      await claims.release('pro', userId);
      await audit(req, { action: `pro.${decision}`, targetType: 'user', targetId: userId, reason: reason ?? null, before: { status: u.pro?.status }, after: { change: !!pending, decision } });
      await deps.bus.emit('pro.decided', { userId, decision: decision === 'approve' ? 'approved' : 'rejected', reason: reason ?? null });
    },

    async revoke(req: Request, userId: string, reason: string) {
      const res = await UserModel.updateOne(
        { _id: userId, 'pro.status': 'approved' },
        { $set: { 'pro.status': 'revoked', 'pro.decisionReason': reason, 'pro.reviewedAt': deps.now(), 'pro.reviewedBy': req.staff!.id, 'pro.pendingApplication': null } },
      );
      if (!res.modifiedCount) throw new AppError(409, 'INVALID_TRANSITION', 'Compte non professionnel');
      await audit(req, { action: 'pro.revoke', targetType: 'user', targetId: userId, reason, before: { status: 'approved' }, after: { status: 'revoked' } });
      await deps.bus.emit('pro.decided', { userId, decision: 'revoked', reason });
    },
  };
}

export type ProService = ReturnType<typeof createProService>;
