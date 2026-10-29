import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../realtime/socket';
import { badgeText, colors, MAX_FONT_SCALE, MIN_TOUCH } from '../theme';

/** Cloche de l'en-tête (Accueil, Annonces), avec le nombre de notifications non lues. */
/** light : sur un en-tête de couleur (accueil). */
export function HeaderBell({ light = false }: { light?: boolean }) {
  const { t } = useTranslation();
  const { counters } = useSocket();
  const unread = counters.unreadNotifications;
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      style={[styles.bell, light && styles.bellLight]}
      accessibilityRole="button"
      accessibilityLabel={unread ? `${t('notif:title')} (${unread})` : t('notif:title')}
    >
      <Ionicons name="notifications-outline" size={22} color={light ? '#FFFFFF' : colors.navy} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={badgeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bellLight: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.24)' },
  badge: {
    position: 'absolute',
    top: -2,
    end: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
