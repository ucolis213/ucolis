// Photos : redimensionnées à 1 600 px de côté au plus, JPEG qualité 0,7, puis envoyées directement
// sur Cloudinary par upload signé, avec progression.

import * as ImageManipulator from 'expo-image-manipulator';
import type { FileRef, UploadPurpose, UploadSignature } from '@ucolis/shared';
import { api } from './client';

export const MAX_SIDE = 1600;

export async function compressImage(uri: string, width?: number, height?: number) {
  const resize =
    width && height && Math.max(width, height) > MAX_SIDE
      ? width >= height
        ? { width: MAX_SIDE }
        : { height: MAX_SIDE }
      : null;
  const result = await ImageManipulator.manipulateAsync(uri, resize ? [{ resize }] : [], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

export async function uploadFile(
  purpose: UploadPurpose,
  file: { uri: string; mimeType?: string; name?: string },
  onProgress?: (ratio: number) => void,
): Promise<FileRef> {
  const sig = await api.post<UploadSignature>('/uploads/signature', { purpose });
  const isPdf = file.mimeType === 'application/pdf' || file.uri.toLowerCase().endsWith('.pdf');
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    type: file.mimeType ?? (isPdf ? 'application/pdf' : 'image/jpeg'),
    name: file.name ?? (isPdf ? 'document.pdf' : 'photo.jpg'),
  } as unknown as Blob);
  for (const [k, v] of Object.entries(sig.params)) form.append(k, String(v));
  form.append('api_key', sig.apiKey);
  form.append('signature', sig.signature);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', sig.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new Error('upload'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`upload ${xhr.status}`));
      const body = JSON.parse(xhr.responseText) as {
        secure_url: string;
        public_id: string;
        format?: string;
      };
      resolve({
        url: body.secure_url,
        publicId: body.public_id,
        kind: body.format === 'pdf' ? 'pdf' : 'image',
      });
    };
    xhr.send(form);
  });
}
