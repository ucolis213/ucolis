import { Router } from 'express';
import type { Deps } from '../../deps';
import { authenticate } from '../../lib/auth';
import { AppError } from '../../lib/errors';
import { idParam } from '../../lib/http';
import { canMessage } from '../conversations/service';
import { UserModel, type UserLean } from './model';
import { toPublicUser } from './serializers';

/**
 * Profils publics : aucune donnée de contact, nom filtré, statistiques de confiance. canContact : « Contacter »
 * n'est proposé qu'après une livraison acceptée entre le visiteur connecté et ce profil (F13).
 */
export function userRoutes(deps: Deps): Router {
  const r = Router();
  const maybeAuth = authenticate(deps.config.accessSecret, { optional: true, now: deps.now });
  r.get('/users/:id', maybeAuth, async (req, res) => {
    const user = (await UserModel.findById(idParam(req)).lean()) as UserLean | null;
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Utilisateur introuvable');
    const viewerId = req.auth?.userId;
    const target = user._id.toString();
    const canContact = !!viewerId && viewerId !== target && (await canMessage(viewerId, target, null));
    res.json({ ...toPublicUser(user), canContact });
  });
  return r;
}
