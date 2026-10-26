import { Stack } from 'expo-router';
import { Sheet } from '@/components/SheetContext';
import { colors } from '@/theme';

/** Les écrans d'authentification s'ouvrent en feuille par-dessus l'écran en cours. */
export default function AuthLayout() {
  return (
    <Sheet>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}
      />
    </Sheet>
  );
}
