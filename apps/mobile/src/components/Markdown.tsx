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

/** FAQ : chaque « ## Question » suivi de sa réponse. */
export function parseFaq(body: string): { question: string; answer: string }[] {
  return body
    .split(/^##\s+/m)
    .slice(1)
    .map((chunk) => {
      const [question = '', ...rest] = chunk.split('\n');
      return { question: question.trim(), answer: rest.join('\n').trim() };
    })
    .filter((e) => e.question);
}
