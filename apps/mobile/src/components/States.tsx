// Les états communs à tous les écrans de liste : vide, erreur, chargement (squelette).

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radii, space } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export function EmptyState({
  icon = 'cube-outline',
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={42} color={colors.primary} />
      </View>
      <AppText size="lg" weight="bold" align="center">
        {title}
      </AppText>
      {body && (
        <AppText size="sm" color={colors.textMuted} align="center">
          {body}
        </AppText>
      )}
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={t('errorTitle')}
      body={message}
      actionLabel={onRetry ? t('retry') : undefined}
      onAction={onRetry}
    />
  );
}

export function Skeleton({
  height = 16,
  width = '100%',
}: {
  height?: number;
  width?: DimensionValue;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      style={{ height, width, opacity, backgroundColor: colors.border, borderRadius: radii.input }}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: space(8), gap: space(3) },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(2),
  },
  action: { alignSelf: 'stretch', marginTop: space(2) },
});
