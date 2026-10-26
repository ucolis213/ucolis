// Rendu minimal du Markdown éditorial (titres, listes, paragraphes) : le back-office n'en produit pas plus.

import { View } from 'react-native';
import { space } from '../theme';
import { AppText } from './AppText';

export function Markdown({ body }: { body: string }) {
  const blocks = body.trim().split(/\n{2,}/);
  return (
    <View style={{ gap: space(3) }}>
      {blocks.map((block, i) => {
        const heading = /^(#{1,3})\s+(.*)$/.exec(block);
        if (heading) {
          return (
            <AppText key={i} size={heading[1]!.length === 1 ? 'xl' : 'lg'} weight="bold">
              {heading[2]}
            </AppText>
          );
        }
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <View key={i} style={{ gap: space(1) }}>
              {lines.map((l, j) => (
                <AppText key={j}>• {l.replace(/^\s*[-*]\s+/, '')}</AppText>
              ))}
            </View>
          );
        }
        return <AppText key={i}>{lines.join(' ').replace(/\*\*(.+?)\*\*/g, '$1')}</AppText>;
      })}
    </View>
  );
}

export interface FaqEntry {
  /** Rubrique « # Titre » qui précède la question ; vide si la FAQ n'en a pas. */
  section: string;
  question: string;
  answer: string;
}

/** FAQ : rubriques « # Rubrique », puis chaque « ## Question » suivi de sa réponse. */
export function parseFaq(body: string): FaqEntry[] {
  const entries: FaqEntry[] = [];
  let section = '';
  let current: { section: string; question: string; lines: string[] } | null = null;
  const flush = () => {
    if (current?.question) entries.push({ section: current.section, question: current.question, answer: current.lines.join('\n').trim() });
    current = null;
  };
  for (const line of body.split('\n')) {
    const h1 = /^#\s+(.*)$/.exec(line);
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h1) {
      flush();
      section = h1[1]!.trim();
    } else if (h2) {
      flush();
      current = { section, question: h2[1]!.trim(), lines: [] };
    } else {
      current?.lines.push(line);
    }
  }
  flush();
  return entries;
}
