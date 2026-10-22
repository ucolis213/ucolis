import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, space } from '../theme';

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top'],
  background = colors.background,
  contentStyle,
  header,
  footer,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  background?: string;
  contentStyle?: ViewStyle;
  /** Au-dessus du contenu, hors défilement et hors marges. */
  header?: ReactNode;
  /** Barre d'actions collée en bas. */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const inner = [padded && styles.padded, contentStyle];
  // Clavier ouvert : l'écran rétrécit, le bas du contenu et la barre d'actions restent accessibles.
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: background }]}>
        {header}
        {scroll ? (
          <ScrollView
            contentContainerStyle={inner}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.root, ...inner]}>{children}</View>
        )}
        {footer && <View style={styles.footer}>{footer}</View>}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { padding: space(5), gap: space(4) },
  footer: {
    paddingHorizontal: space(5),
    paddingVertical: space(3),
    gap: space(2),
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
