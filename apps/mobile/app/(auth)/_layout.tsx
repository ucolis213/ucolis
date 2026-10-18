import { Stack } from 'expo-router';
import { colors } from '@/theme';

/** Les écrans d'authentification s'ouvrent en feuille par-dessus l'écran en cours. */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}
    />
  );
}
