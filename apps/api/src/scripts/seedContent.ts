// Publie la première version de la FAQ, des CGU et de la politique de confidentialité, en français et en arabe.
// Usage : pnpm --filter api seed:content
// Textes dans src/modules/content/defaults/<clé>.<langue>.md. Un contenu déjà publié depuis le back-office n'est
// jamais écrasé : les versions suivantes se publient depuis la page Contenus.

import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { CONTENT_LOCALES } from '@ucolis/shared';
import { loadEnv } from '../config/env';
import { CONTENT_KEYS, ContentModel } from '../modules/content/model';

const DEFAULTS_DIR = new URL('../modules/content/defaults/', import.meta.url);

async function main() {
  const env = loadEnv();
  await mongoose.connect(env.MONGODB_URI);
  await ContentModel.init();
  for (const key of CONTENT_KEYS) {
    for (const locale of CONTENT_LOCALES) {
      const existing = await ContentModel.findOne({ key, locale }).lean();
      if (existing?.publishedAt) {
        console.log(`${key}.${locale} : déjà publié (v${existing.version}), inchangé.`);
        continue;
      }
      const body = (await readFile(new URL(`${key}.${locale}.md`, DEFAULTS_DIR), 'utf8')).trim();
      const version = (existing?.version ?? 0) + 1;
      await ContentModel.updateOne(
        { key, locale },
        { $set: { body, draft: null, version, publishedAt: new Date() } },
        { upsert: true },
      );
      console.log(`${key}.${locale} : publié (v${version}).`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
