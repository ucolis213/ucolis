// Files en attente du back-office, avec l'âge du plus ancien dossier (en heures).

import { DisputeModel, ReportModel } from '../trust/model';
import { UserModel } from '../users/model';

const ageHours = (d: Date | null | undefined, now: Date) =>
  d ? Math.round((now.getTime() - d.getTime()) / 3_600_000) : null;

export async function queueStats(now: Date) {
  const [identityCount, identityOldest, proCount, proOldest] = await Promise.all([
    UserModel.countDocuments({ 'carrierVerification.status': 'pending' }),
    UserModel.findOne({ 'carrierVerification.status': 'pending' }, { 'carrierVerification.submittedAt': 1 })
      .sort({ 'carrierVerification.submittedAt': 1 })
      .lean(),
    UserModel.countDocuments({ 'pro.status': 'pending' }),
    UserModel.findOne({ 'pro.status': 'pending' }, { 'pro.submittedAt': 1 }).sort({ 'pro.submittedAt': 1 }).lean(),
  ]);
  return {
    identity: { count: identityCount, oldestHours: ageHours(identityOldest?.carrierVerification?.submittedAt, now) },
    pro: { count: proCount, oldestHours: ageHours(proOldest?.pro?.submittedAt, now) },
    ...(await extraQueues(now)),
  };
}

/** Signalements et litiges ouverts (lot 7). */
async function extraQueues(now: Date): Promise<Record<string, { count: number; oldestHours: number | null }>> {
  const [reports, oldestReport, disputes, oldestDispute] = await Promise.all([
    ReportModel.countDocuments({ status: 'open' }),
    ReportModel.findOne({ status: 'open' }, { createdAt: 1 }).sort({ createdAt: 1 }).lean(),
    DisputeModel.countDocuments({ status: { $in: ['open', 'in_review'] } }),
    DisputeModel.findOne({ status: { $in: ['open', 'in_review'] } }, { createdAt: 1 }).sort({ createdAt: 1 }).lean(),
  ]);
  return {
    reports: { count: reports, oldestHours: ageHours(oldestReport?.createdAt, now) },
    disputes: { count: disputes, oldestHours: ageHours(oldestDispute?.createdAt, now) },
  };
}
