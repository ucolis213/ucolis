// Fenêtre modale de l'application. Un Modal React Native est une fenêtre native à part : sans fournisseur
// propre, les SafeAreaView qu'il contient reçoivent des marges nulles et le contenu passe sous l'encoche,
// l'heure et la barre d'accueil. Le clavier y est aussi évité (iOS), comme dans Screen.

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, type ModalProps } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export function AppModal({
  children,
  avoidKeyboard = true,
  ...props
}: ModalProps & { children: ReactNode; avoidKeyboard?: boolean }) {
  return (
    <Modal {...props}>
      <SafeAreaProvider>
        {avoidKeyboard ? (
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {children}
          </KeyboardAvoidingView>
        ) : (
          children
        )}
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
