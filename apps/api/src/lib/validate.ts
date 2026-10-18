// Middleware validate(schema) : chaque corps et chaque paramètre passe par un schéma zod de shared.
// Le résultat validé remplace l'entrée ; les champs inconnus (prix suggéré du client, etc.) disparaissent.

import type { RequestHandler } from 'express';
import type { z } from 'zod';

type Source = 'body' | 'query' | 'params';

export type ValidatingHandler = RequestHandler & { schema?: z.ZodType; source?: Source };

export function validate(schema: z.ZodType, source: Source = 'body'): ValidatingHandler {
  const handler: ValidatingHandler = (req, _res, next) => {
    const parsed = schema.parse(req[source]);
    if (source === 'body') req.body = parsed;
    // Express 5 expose req.query et req.params en lecture seule : on range le résultat à part.
    else req.validated = { ...req.validated, [source]: parsed };
    next();
  };
  // Exposé pour la génération de la documentation OpenAPI.
  handler.schema = schema;
  handler.source = source;
  return handler;
}

declare module 'express-serve-static-core' {
  interface Request {
    validated?: Partial<Record<Source, unknown>>;
  }
}
