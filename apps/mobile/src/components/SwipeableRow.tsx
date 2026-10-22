// Ligne qui révèle une action en glissant vers le début de la lecture : de droite à gauche en français,
// de gauche à droite en arabe. Sans module natif (PanResponder et Animated), donc utilisable dans Expo Go.
// Le parent passe une `key` propre à l'élément : une liste recyclée ne doit pas garder une ligne ouverte.

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, I18nManager, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { colors, space } from '@/theme';
import { AppText } from './AppText';

const ACTION_WIDTH = 92;

export function SwipeableRow({
  children,
  actionLabel,
  actionIcon,
  onAction,
}: {
  children: ReactNode;
  actionLabel: string;
  actionIcon: keyof typeof Ionicons.glyphMap;
  onAction: () => void;
}) {
  // Sens d'ouverture à l'écran : les transformations ne sont pas inversées par le RTL.
  const dir = I18nManager.isRTL ? 1 : -1;
  const [x] = useState(() => new Animated.Value(0));
  const [open, setOpen] = useState(false);
  // Lu par les gestionnaires du geste, qui ne voient pas l'état React à jour.
  const openRef = useRef(false);

  const settle = useCallback(
    (toOpen: boolean) => {
      openRef.current = toOpen;
      setOpen(toOpen);
      Animated.spring(x, { toValue: toOpen ? dir * ACTION_WIDTH : 0, useNativeDriver: true, bounciness: 0 }).start();
    },
    [x, dir],
  );

  const pan = useMemo(() => {
    // Position bornée entre fermé et un peu au-delà de l'ouverture.
    const clamp = (v: number) => (dir < 0 ? Math.min(0, Math.max(v, -ACTION_WIDTH * 1.3)) : Math.max(0, Math.min(v, ACTION_WIDTH * 1.3)));
    const position = (dx: number) => clamp((openRef.current ? dir * ACTION_WIDTH : 0) + dx);
    // eslint-disable-next-line react-hooks/refs -- la ref n'est lue que dans les gestionnaires, jamais au rendu.
    return PanResponder.create({
      // Geste nettement horizontal : le défilement vertical de la liste reste prioritaire.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(position(g.dx)),
      onPanResponderRelease: (_, g) => settle(Math.abs(position(g.dx)) > ACTION_WIDTH / 2),
      onPanResponderTerminate: () => settle(openRef.current),
    });
  }, [x, dir, settle]);

  return (
    <View
      style={styles.container}
      accessibilityActions={[{ name: 'action', label: actionLabel }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'action' && onAction()}
    >
      <Pressable
        style={styles.action}
        onPress={() => {
          settle(false);
          onAction();
        }}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
        <Ionicons name={actionIcon} size={22} color="#FFFFFF" />
        <AppText size="xs" weight="semibold" color="#FFFFFF" align="center" numberOfLines={2}>
          {actionLabel}
        </AppText>
      </Pressable>
      <Animated.View style={[styles.content, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
        {/* Ligne ouverte : un toucher la referme au lieu d'ouvrir l'élément. */}
        {open && <Pressable style={StyleSheet.absoluteFill} onPress={() => settle(false)} accessible={false} />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  action: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    end: 0,
    width: ACTION_WIDTH,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(1),
    paddingHorizontal: space(2),
  },
  content: { backgroundColor: colors.background },
});
