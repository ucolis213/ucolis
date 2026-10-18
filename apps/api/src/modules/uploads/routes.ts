import { Router } from 'express';
import { UPLOAD_RULES, uploadFolder, uploadSignatureSchema, type UploadPurpose } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser } from '../../lib/auth';
import { uploadSignature } from '../../lib/cloudinary';
import { validate } from '../../lib/validate';

/** POST /uploads/signature : signature limitée au dossier, au type d'accès et aux formats de l'usage. */
export function uploadRoutes(deps: Deps): Router {
  const r = Router();
  r.post(
    '/uploads/signature',
    authenticate(deps.config.accessSecret, { now: deps.now }),
    validate(uploadSignatureSchema),
    (req, res) => {
      const purpose = req.body.purpose as UploadPurpose;
      const rule = UPLOAD_RULES[purpose];
      const signed = uploadSignature(deps.config.cloudinary, {
        folder: uploadFolder(purpose, currentUser(req).userId),
        type: rule.access,
        formats: rule.formats,
        timestamp: Math.floor(deps.now().getTime() / 1000),
      });
      res.json({ ...signed, maxBytes: rule.maxBytes });
    },
  );
  return r;
}
