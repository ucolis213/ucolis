// Documents légaux du site : les mêmes fichiers que ceux publiés par l'API à l'initialisation des contenus
// (apps/api/src/modules/content/defaults). Une version modifiée ensuite depuis le back-office n'est pas reprise
// ici : la republier aussi dans ces fichiers.

import privacyAr from '../../api/src/modules/content/defaults/privacy.ar.md?raw';
import privacyFr from '../../api/src/modules/content/defaults/privacy.fr.md?raw';
import termsAr from '../../api/src/modules/content/defaults/terms.ar.md?raw';
import termsFr from '../../api/src/modules/content/defaults/terms.fr.md?raw';

export const LEGAL_DOCS = {
  cgu: { fr: termsFr, ar: termsAr },
  confidentialite: { fr: privacyFr, ar: privacyAr },
} as const;

export type LegalDoc = keyof typeof LEGAL_DOCS;

/** Adresse d'un document : « #/cgu », distincte des ancres de sections (« #faq »). */
export const legalHref = (doc: LegalDoc) => `#/${doc}`;

export function legalDocFromHash(hash: string): LegalDoc | null {
  const key = hash.replace(/^#\//, '');
  return hash.startsWith('#/') && key in LEGAL_DOCS ? (key as LegalDoc) : null;
}

export type Block =
  | { type: 'h1' | 'h2' | 'h3' | 'p'; text: string }
  | { type: 'ul'; items: string[] };

/** Markdown réduit aux éléments des documents légaux : titres (#, ##, ###), paragraphes et listes « - ». */
export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    const text = line.trim();
    if (!text) continue;
    const heading = /^(#{1,3})\s+(.*)$/.exec(text);
    if (heading) {
      blocks.push({ type: (['h1', 'h2', 'h3'] as const)[heading[1]!.length - 1]!, text: heading[2]! });
    } else if (text.startsWith('- ')) {
      const last = blocks.at(-1);
      if (last?.type === 'ul') last.items.push(text.slice(2));
      else blocks.push({ type: 'ul', items: [text.slice(2)] });
    } else {
      blocks.push({ type: 'p', text });
    }
  }
  return blocks;
}
