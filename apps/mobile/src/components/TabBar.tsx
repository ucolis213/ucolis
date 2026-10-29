// Barre d'onglets flottante : pilule blanche à ombre douce, décollée des bords, onglet actif sur une pastille
// bleu doux, bouton Publier surélevé au centre. Elle flotte au-dessus du contenu : les écrans à onglets réservent
// en bas la place qu'elle occupe (useTabBarSpace).

import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { createContext, useContext, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { badgeText, colors, fontFamily, MAX_FONT_SCALE, radii, space } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Icônes de chaque onglet : contour au repos, pleine une fois sélectionné. */
export const TAB_ICONS: Record<string, [IconName, IconName]> = {
  home: ['home-outline', 'home'],
  listings: ['search-outline', 'search'],
  publish: ['add', 'add'],
  messages: ['chatbubbles-outline', 'chatbubbles'],
  profile: ['person-outline', 'person'],
};

const BAR_HEIGHT = 64;
const MUTED = colors.textSubtle;
/** Écart entre la pilule et le bas de l'écran quand l'appareil n'a pas de zone protégée. */
const MIN_BOTTOM = space(3);

/** Hauteur occupée par la barre en bas de l'écran (pilule, écart du bas, petit espace au-dessus). */
export const tabBarSpace = (bottomInset: number) => BAR_HEIGHT + Math.max(bottomInset, MIN_BOTTOM) + space(3);

/**
 * Marge à réserver en bas d'un écran à onglets : la barre flotte au-dessus du contenu. Zéro hors des onglets.
 * Fournie par le layout des onglets, lue par Screen et par les listes des onglets.
 */
export const TabBarSpaceContext = createContext(0);
export const useTabBarSpace = () => useContext(TabBarSpaceContext);

export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  // Android redimensionne l'écran sous le clavier : la barre se cache pendant la saisie.
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboard) return null;

  return (
    // Superposée au contenu, sans fond : seule la pilule se voit, le contenu défile dessous et autour.
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, MIN_BOTTOM) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const focused = index === state.index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const [idle, active] = TAB_ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const badge = options.tabBarBadge;

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });

          const publish = route.name === 'publish';
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${label} (${badge})` : label}
              // Le bouton Publier dépasse au-dessus de la barre : la zone tactile le suit.
              hitSlop={publish ? { top: 14 } : undefined}
              style={styles.item}
            >
              {publish ? (
                // Emplacement de la hauteur des autres icônes, pour que « Publier » soit sur la ligne des autres
                // libellés ; le bouton, détouré de la couleur de la barre, en déborde vers le haut.
                <View style={styles.iconPill}>
                  <View style={styles.publish}>
                    <Ionicons name="add" size={26} color="#FFFFFF" />
                  </View>
                </View>
              ) : (
                <View style={[styles.iconPill, focused && styles.iconPillOn]}>
                  <Ionicons name={focused ? active : idle} size={21} color={focused ? colors.primary : MUTED} />
                  {badge !== undefined && (
                    <View style={styles.badge}>
                      <Text style={badgeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {typeof badge === 'number' && badge > 99 ? '99+' : badge}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                style={[styles.label, { fontFamily: fontFamily(focused ? 'bold' : 'medium'), color: focused ? colors.primary : MUTED }]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: space(4), pointerEvents: 'box-none' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    paddingHorizontal: space(1),
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.surface,
    // Fin contour gris clair (couleur du fond des écrans).
    borderWidth: 1,
    borderColor: colors.background,
    shadowColor: colors.navy,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  item: { flex: 1, height: BAR_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconPill: { width: 44, height: 28, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center' },
  iconPillOn: { backgroundColor: colors.primarySoft },
  label: { fontSize: 10, lineHeight: 13, textAlign: 'center' },
  publish: {
    // Posé sur le bas de l'emplacement (28) : il dépasse de 20 vers le haut, sans décaler le libellé.
    position: 'absolute',
    bottom: 0,
    width: 48,
    height: 48,
    borderRadius: radii.tile,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    top: -4,
    end: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
