// Journal d'audit : chaque action d'écriture du staff (et chaque lecture de données personnelles).

import type { Request } from 'express';
import { AuditLogModel } from '../modules/admin/model';

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function audit(req: Request, entry: AuditEntry) {
  if (!req.staff) return;
  await AuditLogModel.create({
    actor: req.staff.id,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    reason: entry.reason ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  });
}
