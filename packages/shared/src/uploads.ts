// Règles d'upload par usage : dossier Cloudinary, type d'accès, formats et taille maximale.

import type { UploadPurpose } from './enums';

export interface UploadRule {
  /** Les pièces d'identité et justificatifs pro ne sont jamais publics. */
  access: 'upload' | 'authenticated';
  formats: readonly string[];
  maxBytes: number;
}

const IMAGES = ['jpg', 'jpeg', 'png', 'webp', 'heic'] as const;
const DOCS = [...IMAGES, 'pdf'] as const;
const MB = 1024 * 1024;

export const UPLOAD_RULES: Record<UploadPurpose, UploadRule> = {
  parcel_photo: { access: 'upload', formats: IMAGES, maxBytes: 10 * MB },
  avatar: { access: 'upload', formats: IMAGES, maxBytes: 10 * MB },
  message_image: { access: 'upload', formats: IMAGES, maxBytes: 10 * MB },
  vehicle_photo: { access: 'upload', formats: IMAGES, maxBytes: 10 * MB },
  dispute_photo: { access: 'upload', formats: IMAGES, maxBytes: 10 * MB },
  delivery_proof: { access: 'upload', formats: IMAGES, maxBytes: 10 * MB },
  identity_doc: { access: 'authenticated', formats: DOCS, maxBytes: 10 * MB },
  pro_doc: { access: 'authenticated', formats: DOCS, maxBytes: 10 * MB },
};

/** Dossier Cloudinary propre à l'usage et à l'utilisateur : l'API vérifie qu'un fichier lui appartient. */
export const uploadFolder = (purpose: UploadPurpose, userId: string) =>
  `ucolis/${purpose}/${userId}`;

export function isOwnedUpload(publicId: string, purpose: UploadPurpose, userId: string): boolean {
  return publicId.startsWith(`${uploadFolder(purpose, userId)}/`);
}
