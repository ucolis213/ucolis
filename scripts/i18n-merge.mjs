// Fusionne un fichier de clés (fr et ar) dans packages/shared/src/i18n/{fr,ar}.json.
// Usage : node scripts/i18n-merge.mjs <patch.json>  où patch = { "fr": {...}, "ar": {...} }
import { readFileSync, writeFileSync } from 'node:fs';

const patch = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const merge = (target, src) => {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) target[k] = merge(target[k] ?? {}, v);
    else target[k] = v;
  }
  return target;
};
for (const locale of ['fr', 'ar']) {
  if (!patch[locale]) continue;
  const file = new URL(`../packages/shared/src/i18n/${locale}.json`, import.meta.url);
  const data = merge(JSON.parse(readFileSync(file, 'utf8')), patch[locale]);
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
console.log('i18n mis à jour');
