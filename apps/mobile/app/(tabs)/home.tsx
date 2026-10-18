import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Paginated, ParcelCardDto } from '@ucolis/shared';
import { api, qs } from '@/api/client';
import { useParcels } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { HeaderBell } from '@/components/HeaderBell';
import { ParcelCard } from '@/components/ParcelCard';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { isCarrierIntent, useSession } from '@/session/SessionContext';
import { useFilters } from '@/state/filters';
import { colors, MIN_TOUCH, radii, shadow, space } from '@/theme';

/** Compteurs de l'accueil : colis actifs, offres actives, livraisons en cours. */
function useHomeCounters(enabled: boolean) {
  return useQuery({
    queryKey: ['me', 'home-counters'],
    enabled,
    queryFn: async () => {
      const [parcels, offers, deliveries] = await Promise.all([
        api.get<Paginated<ParcelCardDto>>(`/me/parcels${qs({ status: 'open,negotiating,assigned,in_transit,delivered_pending,disputed', limit: 1 })}`),
        api.get<Paginated<unknown>>(`/me/offers${qs({ tab: 'active', limit: 1 })}`),
        api.get<Paginated<unknown>>(`/me/offers${qs({ tab: 'accepted', limit: 1 })}`),
      ]);
      return { parcels: parcels.total, offers: offers.total, deliveries: deliveries.total };
    },
  });
}

export default function Home() {
  const { t } = useTranslation(['common', 'parcel']);
  const { user, isGuest } = useSession();
  const requireAuth = useRequireAuth();
  const setFilters = useFilters((s) => s.setParcels);
  const counters = useHomeCounters(!isGuest);
  // Dernières annonces sur la wilaya de l'utilisateur (départ ou arrivée).
  const latest = useParcels(user ? { fromWilaya: user.wilayaCode, limit: 5 } : { limit: 5 });
  const showTrip = isGuest || isCarrierIntent(user?.intent);
  const carrierPending = user && isCarrierIntent(user.intent) && user.carrierVerification.status !== 'approved';

  return (
    <Screen scroll onRefresh={() => Promise.all([latest.refetch(), counters.refetch()])} refreshing={latest.isRefetching}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold" style={styles.flex}>
          {user ? t('home.greeting', { name: user.firstName }) : t('home.guestGreeting')}
        </AppText>
        <HeaderBell />
      </View>

      {user && !user.emailVerified && (
        <Banner text={t('home.emailBanner')} onPress={() => router.push({ pathname: '/verify-email', params: { email: user.email } })} />
      )}
      {carrierPending && <Banner text={t('home.carrierBanner')} onPress={() => router.push('/me/carrier-verification')} />}

      <Pressable
        style={styles.search}
        onPress={() => router.push('/listings')}
        accessibilityRole="search"
        accessibilityLabel={t('home.searchPlaceholder')}
      >
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <AppText color={colors.textSubtle}>{t('home.searchPlaceholder')}</AppText>
      </Pressable>

      <View style={styles.actions}>
        <ActionCard primary icon="cube" label={t('home.publishParcel')} onPress={() => requireAuth(() => router.push('/parcel/new/route'), { returnTo: '/parcel/new/route' })} />
        {showTrip && (
          <ActionCard icon="car" label={t('home.proposeTrip')} onPress={() => requireAuth(() => router.push('/trip/new'), { returnTo: '/trip/new' })} />
        )}
      </View>

      {user && (
        <View style={styles.counters}>
          <Counter label={t('home.activeParcels')} value={counters.data?.parcels} href="/me/parcels" />
          <Counter label={t('home.activeOffers')} value={counters.data?.offers} href="/me/offers" />
          <Counter label={t('home.ongoingDeliveries')} value={counters.data?.deliveries} href="/me/deliveries" />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <AppText size="lg" weight="bold">
          {t('home.latestListings')}
        </AppText>
        <AppText
          size="sm"
          weight="semibold"
          color={colors.primaryDark}
          accessibilityRole="link"
          onPress={() => {
            if (user) setFilters({ fromWilaya: user.wilayaCode });
            router.push('/listings');
          }}
        >
          {t('seeAll')}
        </AppText>
      </View>
      <QueryView
        query={{ ...latest, data: latest.data?.pages.flatMap((p) => p.items) }}
        isEmpty={(items) => items.length === 0}
        empty={{ icon: 'cube-outline', title: t('parcel:noListings') }}
        skeletonRows={2}
      >
        {(items) => (
          <View style={styles.list}>
            {items.slice(0, 5).map((p) => (
              <ParcelCard key={p.id} parcel={p} />
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

function Banner({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable style={styles.banner} onPress={onPress} accessibilityRole="button">
      <Ionicons name="information-circle" size={20} color="#B7791F" />
      <AppText size="sm" style={styles.flex}>
        {text}
      </AppText>
    </Pressable>
  );
}

function ActionCard({ icon, label, primary = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; primary?: boolean; onPress: () => void }) {
  const fg = primary ? '#FFFFFF' : colors.primaryDark;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, primary ? styles.cardPrimary : styles.cardSecondary, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.cardIcon, { backgroundColor: primary ? 'rgba(255,255,255,0.2)' : colors.primarySoft }]}>
        <Ionicons name={icon} size={24} color={fg} />
      </View>
      <AppText weight="semibold" color={primary ? '#FFFFFF' : colors.navy} align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

function Counter({ label, value, href }: { label: string; value: number | undefined; href: string }) {
  return (
    <Pressable style={styles.counter} onPress={() => router.push(href as Href)} accessibilityRole="button" accessibilityLabel={`${label} ${value ?? ''}`}>
      <AppText size="xl" weight="bold" color={colors.primary}>
        {value ?? '–'}
      </AppText>
      <AppText size="xs" color={colors.textMuted} align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    minHeight: MIN_TOUCH + 6,
    paddingHorizontal: space(4),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadow,
  },
  actions: { flexDirection: 'row', gap: space(3) },
  card: { flex: 1, alignItems: 'center', gap: space(2), padding: space(4), borderRadius: radii.card, borderWidth: 1 },
  cardPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  cardSecondary: { backgroundColor: colors.surface, borderColor: colors.primary },
  cardIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  counters: { flexDirection: 'row', gap: space(3) },
  counter: { flex: 1, alignItems: 'center', padding: space(3), borderRadius: radii.card, backgroundColor: colors.surface, ...shadow },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { gap: space(3) },
  banner: { flexDirection: 'row', gap: space(2), padding: space(3), borderRadius: radii.card, backgroundColor: colors.warningSoft },
});
