// Signatures Cloudinary calculées localement (aucun SDK) : upload signé direct depuis le client,
// et URL de téléchargement privée à durée limitée pour les pièces « authenticated ».

import { createHash } from 'node:crypto';

export interface CloudinaryCreds {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Signature Cloudinary : SHA-1 des paramètres triés « k=v&… » suivis du secret. */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const base = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(base + apiSecret).digest('hex');
}

export function uploadSignature(
  creds: CloudinaryCreds,
  opts: { folder: string; type: 'upload' | 'authenticated'; formats: readonly string[]; timestamp: number },
) {
  const params = {
    allowed_formats: opts.formats.join(','),
    folder: opts.folder,
    timestamp: opts.timestamp,
    type: opts.type,
  };
  return {
    cloudName: creds.cloudName,
    apiKey: creds.apiKey,
    uploadUrl: `https://api.cloudinary.com/v1_1/${creds.cloudName}/auto/upload`,
    params,
    signature: signParams(params, creds.apiSecret),
  };
}

/** URL privée, valable jusqu'à expiresAt (secondes), pour un fichier « authenticated ». */
export function privateDownloadUrl(
  creds: CloudinaryCreds,
  publicId: string,
  opts: { resourceType: 'image' | 'raw'; expiresAt: number; timestamp: number; format?: string },
): string {
  const params: Record<string, string | number> = {
    expires_at: opts.expiresAt,
    public_id: publicId,
    timestamp: opts.timestamp,
    type: 'authenticated',
    ...(opts.format ? { format: opts.format } : {}),
  };
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    api_key: creds.apiKey,
    signature: signParams(params, creds.apiSecret),
  });
  return `https://api.cloudinary.com/v1_1/${creds.cloudName}/${opts.resourceType}/download?${query}`;
}

/** URL d'image redimensionnée (w_, q_auto, f_auto) à partir d'une URL Cloudinary publique. */
export function resized(url: string, width: number): string {
  return url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto/`);
}
