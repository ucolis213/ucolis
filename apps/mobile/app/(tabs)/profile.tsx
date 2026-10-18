import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { confirm } from '@/components/ConfirmDialog';
import { GuestGate } from '@/components/GuestGate';
import { MenuRow, MenuSection } from '@/components/MenuRow';
import { RatingStars } from '@/components/RatingStars';
import { Screen } from '@/components/Screen';
import { useSession } from '@/session/SessionContext';
import { colors, radii, shadow, space } from '@/theme';

export default function Profile() {
  const { t } = useTranslation(['profile', 'common']);
  const { user, signOut } = useSession();

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
    <Screen scroll>
      <AppText size="xl" weight="bold">
        {t('title')}
      </AppText>

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
        <MenuRow icon="cube-outline" label={t('myParcels')} onPress={go('/me/parcels')} />
        <MenuRow icon="pricetag-outline" label={t('myOffers')} onPress={go('/me/offers')} />
        <MenuRow icon="car-outline" label={t('myTrips')} onPress={go('/me/trips')} />
        <MenuRow icon="navigate-outline" label={t('myDeliveries')} onPress={go('/me/deliveries')} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space(2), flexWrap: 'wrap' },
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
