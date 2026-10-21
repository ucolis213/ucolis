// Fichiers Cloudinary : suppression (anonymisation d'un compte, ménage des anciennes images) et consommation
// du mois (tableau de bord du back-office).

import type { FileRef, StorageUsageDto } from '@ucolis/shared';
import type { CloudinaryCreds } from './cloudinary';
import { signParams } from './cloudinary';

export interface FileStore {
  destroy(files: FileRef[], type: 'upload' | 'authenticated'): Promise<void>;
  /** null si Cloudinary ne répond pas. */
  usage(): Promise<StorageUsageDto | null>;
}

type Metric = { usage?: number; credits_usage?: number };
interface CloudinaryUsage {
  plan?: string;
  last_updated?: string;
  credits?: { usage?: number; limit?: number; used_percent?: number };
  storage?: Metric;
  bandwidth?: Metric;
  transformations?: Metric;
  objects?: { usage?: number };
}

/** Réponse de l'Admin API « usage » ramenée au format du back-office. */
export function toStorageUsage(u: CloudinaryUsage): StorageUsageDto {
  return {
    plan: u.plan ?? '',
    updatedAt: u.last_updated ? new Date(u.last_updated).toISOString() : null,
    credits: { used: u.credits?.usage ?? 0, limit: u.credits?.limit ?? null, percent: u.credits?.used_percent ?? null },
    storage: { bytes: u.storage?.usage ?? 0, credits: u.storage?.credits_usage ?? 0 },
    bandwidth: { bytes: u.bandwidth?.usage ?? 0, credits: u.bandwidth?.credits_usage ?? 0 },
    transformations: { count: u.transformations?.usage ?? 0, credits: u.transformations?.credits_usage ?? 0 },
    objects: u.objects?.usage ?? 0,
  };
}

export function createCloudinaryFileStore(creds: CloudinaryCreds): FileStore {
  return {
    async destroy(files, type) {
      for (const f of files) {
        const timestamp = Math.floor(Date.now() / 1000);
        const params = { public_id: f.publicId, timestamp, type };
        const resource = f.kind === 'pdf' ? 'raw' : 'image';
        const body = new URLSearchParams({
          ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
          api_key: creds.apiKey,
          signature: signParams(params, creds.apiSecret),
        });
        await fetch(`https://api.cloudinary.com/v1_1/${creds.cloudName}/${resource}/destroy`, { method: 'POST', body });
      }
    },
    async usage() {
      const auth = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${creds.cloudName}/usage`, {
          headers: { Authorization: `Basic ${auth}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        return toStorageUsage((await res.json()) as CloudinaryUsage);
      } catch {
        return null;
      }
    },
  };
}

export function createMemoryFileStore() {
  const destroyed: string[] = [];
  return {
    destroyed,
    async destroy(files: FileRef[]) {
      destroyed.push(...files.map((f) => f.publicId));
    },
    async usage(): Promise<StorageUsageDto | null> {
      return toStorageUsage({ plan: 'Free', credits: { usage: 5, limit: 25, used_percent: 20 } });
    },
  };
}
