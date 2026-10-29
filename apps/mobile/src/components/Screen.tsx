import { useContext, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, radii, space } from '../theme';
import { SheetContext } from './SheetContext';
import { useTabBarSpace } from './TabBar';

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
  // Écran à onglets : la barre flotte au-dessus, le bas du contenu doit rester accessible au-dessus d'elle.
  // Un écran sans marges ni défilement (liste, carte) gère lui-même cette place pour défiler sous la barre.
  const tabSpace = useTabBarSpace();
  const reserve = tabSpace > 0 && (scroll || padded) ? { paddingBottom: tabSpace + space(2) } : null;
  const inner = [padded && styles.padded, reserve, contentStyle];
  // KeyboardAvoidingView compare le clavier (coordonnées de l'écran) à sa propre position relative à son parent.
  // Une feuille iOS (connexion, inscription, signalement, filtres) commence plus bas que le haut de l'écran mais
  // descend jusqu'en bas : le décalage est la hauteur de l'écran moins celle de la feuille. Sans lui, le bas du
  // formulaire et la barre d'actions restent cachés sous le clavier.
  const inSheet = useContext(SheetContext) && Platform.OS === 'ios';
  const { height: windowHeight } = useWindowDimensions();
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);
  const offset = inSheet && sheetHeight ? Math.max(0, Math.round(windowHeight - sheetHeight)) : 0;
  // Clavier ouvert : l'écran rétrécit, le bas du contenu et la barre d'actions restent accessibles.
  return (
    <View
      style={styles.root}
      onLayout={inSheet ? (e) => setSheetHeight(e.nativeEvent.layout.height) : undefined}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={offset}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Tablette : contenu centré, à largeur de lecture ; sans effet sur un téléphone.
  padded: { padding: space(5), gap: space(4), width: '100%', maxWidth: 720, alignSelf: 'center' },
  footer: {
    paddingHorizontal: space(5),
    paddingTop: space(4),
    paddingBottom: space(3),
    gap: space(2),
    backgroundColor: colors.surface,
    borderTopStartRadius: radii.sheet,
    borderTopEndRadius: radii.sheet,
    shadowColor: '#0E1B3D',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
});
