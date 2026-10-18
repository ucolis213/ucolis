import { Router } from 'express';
import { AppError } from '../../lib/errors';
import { idParam } from '../../lib/http';
import { UserModel, type UserLean } from './model';
import { toPublicUser } from './serializers';

/** Profils publics : aucune donnée de contact, nom filtré, statistiques de confiance. */
export function userRoutes(): Router {
  const r = Router();
  r.get('/users/:id', async (req, res) => {
    const user = (await UserModel.findById(idParam(req)).lean()) as UserLean | null;
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Utilisateur introuvable');
    res.json(toPublicUser(user));
  });
  return r;
}
