import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/** Barre d'état claire tant que l'écran (à en-tête de couleur) est affiché, sombre ensuite. */
export function useLightStatusBar(enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, [enabled]),
  );
}
