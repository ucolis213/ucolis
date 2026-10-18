// Suppression de fichiers Cloudinary (anonymisation d'un compte : pièces d'identité, justificatifs pro).

import type { FileRef } from '@ucolis/shared';
import type { CloudinaryCreds } from './cloudinary';
import { signParams } from './cloudinary';

export interface FileStore {
  destroy(files: FileRef[], type: 'upload' | 'authenticated'): Promise<void>;
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
  };
}

export function createMemoryFileStore() {
  const destroyed: string[] = [];
  return {
    destroyed,
    async destroy(files: FileRef[]) {
      destroyed.push(...files.map((f) => f.publicId));
    },
  };
}
