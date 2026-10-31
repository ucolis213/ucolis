// Trajet choisi par le visiteur : partagé entre la recherche de l'accueil et le simulateur de prix.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface RouteValue {
  from: string;
  to: string;
  setFrom: (code: string) => void;
  setTo: (code: string) => void;
  swap: () => void;
}

const RouteContext = createContext<RouteValue | null>(null);

export function RouteProvider({ children }: { children: ReactNode }) {
  // Sétif → Alger : le trajet type de Karim.
  const [from, setFrom] = useState('19');
  const [to, setTo] = useState('16');
  const value = useMemo<RouteValue>(
    () => ({
      from,
      to,
      setFrom,
      setTo,
      swap: () => {
        setFrom(to);
        setTo(from);
      },
    }),
    [from, to],
  );
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useRoute() {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error('useRoute hors de RouteProvider');
  return ctx;
}
