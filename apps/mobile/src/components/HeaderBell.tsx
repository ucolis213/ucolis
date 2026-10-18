import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../realtime/socket';
import { colors, MIN_TOUCH, shadow } from '../theme';
import { AppText } from './AppText';

/** Cloche de l'en-tête (Accueil, Annonces), avec le nombre de notifications non lues. */
export function HeaderBell() {
  const { t } = useTranslation();
  const { counters } = useSocket();
  const unread = counters.unreadNotifications;
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      style={styles.bell}
      accessibilityRole="button"
      accessibilityLabel={unread ? `${t('notif:title')} (${unread})` : t('notif:title')}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.navy} />
      {unread > 0 && (
        <View style={styles.badge}>
          <AppText size="xs" weight="bold" color="#FFFFFF">
            {unread > 99 ? '99+' : unread}
          </AppText>
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
    ...shadow,
  },
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
