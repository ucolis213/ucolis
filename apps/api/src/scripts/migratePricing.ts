// Applique le barème par défaut de shared/pricing à une base existante : remplace le barème enregistré depuis le
// back-office et recalcule le prix suggéré des annonces ouvertes ou en négociation.
// Usage : pnpm --filter api migrate:pricing
// Sans effet si la base utilise déjà ce barème : le script peut être relancé sans risque.

import mongoose from 'mongoose';
import { loadEnv } from '../config/env';
import { migratePricing } from '../modules/pricing/migration';

const REASON = 'Barème du 31 octobre 2026 : prix suggéré sous les tarifs des sociétés de livraison';

async function main() {
  const env = loadEnv();
  await mongoose.connect(env.MONGODB_URI);
  const result = await migratePricing(REASON);
  console.log(
    result.settingReplaced
      ? 'Barème en base remplacé par le nouveau barème (journalisé).'
      : 'Barème en base : déjà à jour ou non personnalisé, inchangé.',
  );
  console.log(`Annonces ouvertes : ${result.parcelsChecked}, prix suggéré recalculé pour ${result.parcelsUpdated}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
