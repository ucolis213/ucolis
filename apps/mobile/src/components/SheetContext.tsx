// Écrans présentés en feuille iOS (presentation: 'modal') : Screen en tient compte pour éviter le clavier.

import { createContext, type ReactNode } from 'react';

export const SheetContext = createContext(false);

/** Enveloppe d'un écran (ou d'un groupe d'écrans) ouvert en feuille. */
export function Sheet({ children }: { children: ReactNode }) {
  return <SheetContext.Provider value>{children}</SheetContext.Provider>;
}
