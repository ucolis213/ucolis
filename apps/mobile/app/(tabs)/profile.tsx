import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CARRIER_INTENTS } from '@ucolis/shared';
import { useWallet } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { useCommission } from '@/components/CommissionBreakdown';
import { confirm } from '@/components/ConfirmDialog';
import { GuestGate } from '@/components/GuestGate';
import { MenuRow, MenuSection } from '@/components/MenuRow';
import { RatingStars } from '@/components/RatingStars';
import { Screen } from '@/components/Screen';
import { useLightStatusBar } from '@/hooks/useLightStatusBar';
import { useSocket } from '@/realtime/socket';
import { price } from '@/format';
import { useSession } from '@/session/SessionContext';
import { colors, radii, shadow, space } from '@/theme';

export default function Profile() {
  const { t } = useTranslation(['profile', 'common']);
  const { user, signOut } = useSession();
  // Portefeuille visible dès que la commission est activée, pour les comptes qui transportent.
  const commission = useCommission();
  const showWallet = !!commission && !!user && (CARRIER_INTENTS.includes(user.intent) || user.carrierVerification.status === 'approved');
  const wallet = useWallet(showWallet);
  const insets = useSafeAreaInsets();
  // Notifications non lues, tenues à jour en temps réel (comme la cloche de l'accueil).
  const { counters } = useSocket();
  // Bandeau bleu seulement une fois connecté.
  useLightStatusBar(!!user);

  if (!user) {
    return (
      <Screen>
        <View style={styles.flex}>
          <GuestGate returnTo="/profile" />
        </View>
        <MenuSection>
          <MenuRow icon="language-outline" label={t('common:language')} onPress={() => router.push('/me/language')} />
          <MenuRow icon="help-circle-outline" label={t('help')} onPress={() => router.push('/help')} />
          <MenuRow icon="lock-closed-outline" label={t('privacy')} onPress={() => router.push('/help/content/privacy')} />
        </MenuSection>
      </Screen>
    );
  }

  const go = (path: string) => () => router.push(path as Href);
  const name =
    user.accountType === 'professional' && user.pro.companyName
      ? user.pro.companyName
      : `${user.firstName} ${user.lastName}`;

  return (
    <Screen scroll padded={false} edges={[]}>
      <View style={[styles.hero, { paddingTop: insets.top + space(4) }]}>
        <View style={styles.blob} />
        <AppText size="xl" weight="bold" color="#FFFFFF">
          {t('title')}
        </AppText>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Avatar file={user.accountType === 'professional' ? (user.pro.logo ?? user.avatar) : user.avatar} name={name} size={64} />
          <View style={styles.flex}>
            <AppText size="lg" weight="bold" numberOfLines={1}>
              {name}
            </AppText>
            <AppText size="sm" color={colors.textMuted}>
              {t(user.accountType)}
            </AppText>
            <View style={styles.row}>
              {user.rating.count > 0 ? (
                <RatingStars value={user.rating.average} count={user.rating.count} size={14} />
              ) : (
                <AppText size="xs" color={colors.textMuted}>
                  {t('noRating')}
                </AppText>
              )}
            </View>
            <View style={styles.row}>
              {user.badges.pro && <Badge kind="pro" />}
              {user.badges.identity && <Badge kind="identity" />}
            </View>
          </View>
        </View>

        {!user.emailVerified && (
          <Button
            label={t('verifyEmailCta')}
            variant="outline"
            icon="mail-unread-outline"
            onPress={() => router.push({ pathname: '/verify-email', params: { email: user.email } })}
          />
        )}

        <MenuSection title={t('sections.activity')}>
          <MenuRow
            icon="notifications-outline"
            label={t('notif:title')}
            badge={counters.unreadNotifications}
            onPress={go('/notifications')}
          />
          <MenuRow icon="cube-outline" label={t('myParcels')} onPress={go('/me/parcels')} />
          <MenuRow icon="pricetag-outline" label={t('myOffers')} onPress={go('/me/offers')} />
          <MenuRow icon="car-outline" label={t('myTrips')} onPress={go('/me/trips')} />
          <MenuRow icon="navigate-outline" label={t('myDeliveries')} onPress={go('/me/deliveries')} />
          {showWallet && (
            <MenuRow icon="wallet-outline" label={t('wallet')} value={wallet.data?.eligible ? price(wallet.data.balance) : undefined} onPress={go('/me/wallet')} />
          )}
          <MenuRow icon="star-outline" label={t('myReviews')} onPress={go('/me/reviews')} />
          <MenuRow icon="heart-outline" label={t('favorites')} onPress={go('/me/favorites')} />
          <MenuRow icon="notifications-outline" label={t('alerts')} onPress={go('/me/alerts')} />
        </MenuSection>

        <MenuSection title={t('sections.account')}>
          <MenuRow icon="person-outline" label={t('editProfile')} onPress={go('/me/edit')} />
          <MenuRow
            icon="briefcase-outline"
            label={t('proStatus')}
            value={t(`proStatuses.${user.pro.status}`)}
            onPress={go('/me/pro')}
          />
          <MenuRow
            icon="shield-checkmark-outline"
            label={t('carrierVerification')}
            value={t(`verificationStatuses.${user.carrierVerification.status}`)}
            onPress={go('/me/carrier-verification')}
          />
          <MenuRow icon="car-sport-outline" label={t('vehicles')} onPress={go('/me/vehicles')} />
          <MenuRow icon="key-outline" label={t('changePassword')} onPress={go('/me/password')} />
          <MenuRow icon="mail-outline" label={t('changeEmail')} value={user.email} onPress={go('/me/email')} />
          <MenuRow icon="phone-portrait-outline" label={t('devices')} onPress={go('/me/devices')} />
          <MenuRow icon="ban-outline" label={t('blockedUsers')} onPress={go('/me/blocked')} />
        </MenuSection>

        <MenuSection title={t('sections.app')}>
          <MenuRow icon="language-outline" label={t('common:language')} onPress={go('/me/language')} />
          <MenuRow icon="notifications-circle-outline" label={t('notificationsSettings')} onPress={go('/me/notifications-settings')} />
          <MenuRow icon="help-circle-outline" label={t('help')} onPress={go('/help')} />
          <MenuRow icon="document-text-outline" label={t('terms')} onPress={go('/help/content/terms')} />
          <MenuRow icon="lock-closed-outline" label={t('privacy')} onPress={go('/help/content/privacy')} />
          <MenuRow icon="information-circle-outline" label={t('about')} onPress={go('/about')} />
        </MenuSection>

        <MenuSection>
          <MenuRow icon="trash-outline" label={t('deleteAccount')} danger onPress={go('/me/delete-account')} />
          <MenuRow
            icon="log-out-outline"
            label={t('logout')}
            danger
            onPress={async () => {
              if (await confirm({ title: t('logout'), message: t('logoutConfirm'), destructive: true })) {
                await signOut();
                router.replace('/home');
              }
            }}
          />
        </MenuSection>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space(2), flexWrap: 'wrap' },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: space(5),
    paddingBottom: space(16),
    borderBottomStartRadius: radii.sheet,
    borderBottomEndRadius: radii.sheet,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 220, height: 220, top: -90, end: -60, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  // Carte d'identité à cheval sur le bandeau.
  content: { padding: space(5), paddingTop: 0, gap: space(4), marginTop: -space(12), width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(4),
    padding: space(4),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadow,
  },
});
