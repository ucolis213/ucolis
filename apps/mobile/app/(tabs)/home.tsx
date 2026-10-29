import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Paginated, ParcelCardDto } from '@ucolis/shared';
import { api, qs } from '@/api/client';
import { useParcels } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { HeaderBell } from '@/components/HeaderBell';
import { ParcelCard } from '@/components/ParcelCard';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { useLightStatusBar } from '@/hooks/useLightStatusBar';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { isCarrierIntent, useSession } from '@/session/SessionContext';
import { useFilters } from '@/state/filters';
import { newParcelRoute } from '@/state/parcelDraft';
import { colors, forwardIcon, MIN_TOUCH, radii, shadow, space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

type IconName = keyof typeof Ionicons.glyphMap;

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
  const resetFilters = useFilters((s) => s.resetParcels);
  const counters = useHomeCounters(!isGuest);
  // Dernières annonces, toutes wilayas confondues (voir DECISIONS.md, 21 octobre 2026).
  const latest = useParcels({ limit: 5 });
  const pull = usePullToRefresh(() => Promise.all([latest.refetch(), counters.refetch()]));
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const showTrip = isGuest || isCarrierIntent(user?.intent);
  const carrierPending = user && isCarrierIntent(user.intent) && user.carrierVerification.status !== 'approved';

  const publish = () => requireAuth(() => router.push(newParcelRoute()), { returnTo: '/parcel/new/quick' });
  const open = (href: string) => () => requireAuth(() => router.push(href as Href), { returnTo: href });
  const seeAll = () => {
    // La liste prolonge l'accueil : aucun filtre, les plus récentes d'abord.
    resetFilters();
    router.push('/listings');
  };

  return (
    <Screen scroll padded={false} edges={[]} {...pull}>
      <View style={[styles.hero, { paddingTop: insets.top + space(4) }]}>
        {/* Formes décoratives du bandeau. */}
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />
        <View style={styles.heroRow}>
          <View style={styles.flex}>
            <AppText size="xl" weight="bold" color="#FFFFFF" numberOfLines={1}>
              {user ? t('home.greeting', { name: user.firstName }) : t('home.guestGreeting')}
            </AppText>
            <AppText size="sm" color="rgba(255,255,255,0.85)">
              {t('home.subtitle')}
            </AppText>
          </View>
          <HeaderBell light />
        </View>
        <Pressable
          style={styles.search}
          onPress={() => router.push('/listings')}
          accessibilityRole="search"
          accessibilityLabel={t('home.searchPlaceholder')}
        >
          <View style={styles.searchIcon}>
            <Ionicons name="search" size={18} color={colors.primary} />
          </View>
          <AppText color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            {t('home.searchPlaceholder')}
          </AppText>
        </Pressable>
      </View>

      <View style={styles.content}>
        {user && !user.emailVerified && (
          <Banner text={t('home.emailBanner')} onPress={() => router.push({ pathname: '/verify-email', params: { email: user.email } })} />
        )}
        {carrierPending && <Banner text={t('home.carrierBanner')} onPress={() => router.push('/me/carrier-verification')} />}

        <AppText size="lg" weight="bold">
          {t('home.services')}
        </AppText>
        <View style={styles.services}>
          <Service icon="cube" label={t('home.publishParcel')} hint={t('home.publishParcelHint')} onPress={publish} />
          {showTrip ? (
            <Service icon="car" label={t('home.proposeTrip')} hint={t('home.proposeTripHint')} onPress={open('/trip/new')} />
          ) : (
            <Service icon="search" label={t('tabs.listings')} hint={t('home.listingsHint')} onPress={seeAll} />
          )}
          <Service icon="file-tray-full" label={t('home.myParcels')} hint={t('home.myParcelsHint')} onPress={open('/me/parcels')} />
          <Service icon="bag-check" label={t('home.myDeliveries')} hint={t('home.myDeliveriesHint')} onPress={open('/me/deliveries')} />
        </View>

        {user && (
          <View style={styles.counters}>
            <Counter label={t('home.activeParcels')} value={counters.data?.parcels} href="/me/parcels" />
            <View style={styles.divider} />
            <Counter label={t('home.activeOffers')} value={counters.data?.offers} href="/me/offers" />
            <View style={styles.divider} />
            <Counter label={t('home.ongoingDeliveries')} value={counters.data?.deliveries} href="/me/deliveries" />
          </View>
        )}

        <Pressable style={({ pressed }) => [styles.promo, pressed && styles.pressed]} onPress={publish} accessibilityRole="button">
          <View style={[styles.blob, styles.promoBlob]} />
          <View style={styles.flex}>
            <AppText size="lg" weight="bold" color="#FFFFFF">
              {t('home.promoTitle')}
            </AppText>
            <AppText size="sm" color="rgba(255,255,255,0.85)">
              {t('home.promoBody')}
            </AppText>
            <View style={styles.promoCta}>
              <AppText size="sm" weight="bold" color={colors.primaryDark}>
                {t('home.publishParcel')}
              </AppText>
            </View>
          </View>
          <Ionicons name="cube" size={64} color="rgba(255,255,255,0.9)" />
        </Pressable>

        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold" style={styles.shrink}>
            {t('home.latestListings')}
          </AppText>
          <AppText size="sm" weight="bold" color={colors.primary} accessibilityRole="link" onPress={seeAll}>
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
      </View>
    </Screen>
  );
}

function Banner({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable style={styles.banner} onPress={onPress} accessibilityRole="button">
      <Ionicons name="information-circle" size={20} color={colors.warningDark} />
      <AppText size="sm" weight="medium" style={styles.flex}>
        {text}
      </AppText>
    </Pressable>
  );
}

/** Carte de service (grille 2 × 2) : pastille d'icône bleue, titre, une ligne d'explication, flèche. */
function Service({ icon, label, hint, onPress }: { icon: IconName; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${hint}`}
      style={({ pressed }) => [styles.service, pressed && styles.pressed]}
    >
      <View style={styles.serviceTop}>
        <View style={styles.serviceIcon}>
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
        <Ionicons name={forwardIcon()} size={18} color={colors.textSubtle} />
      </View>
      <View style={styles.serviceText}>
        <AppText size="sm" weight="bold" numberOfLines={1}>
          {label}
        </AppText>
        <AppText size="xs" color={colors.textMuted} numberOfLines={2}>
          {hint}
        </AppText>
      </View>
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
  shrink: { flexShrink: 1 },
  pressed: { transform: [{ scale: 0.97 }] },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: space(5),
    paddingBottom: space(6),
    gap: space(5),
    borderBottomStartRadius: radii.sheet,
    borderBottomEndRadius: radii.sheet,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  blobA: { width: 220, height: 220, top: -80, end: -60 },
  blobB: { width: 140, height: 140, bottom: -70, start: -30 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    minHeight: MIN_TOUCH + 12,
    paddingStart: space(2),
    paddingEnd: space(4),
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    ...shadow,
  },
  searchIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space(5), gap: space(4), width: '100%', maxWidth: 720, alignSelf: 'center' },
  // Deux colonnes : chaque carte prend la moitié de la ligne moins l'espace entre elles.
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  service: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: space(3),
    padding: space(4),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadow,
  },
  serviceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Même pastille pour tous les services : bleu de marque sur bleu doux.
  serviceIcon: { width: 44, height: 44, borderRadius: radii.input, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  serviceText: { gap: space(0.5) },
  counters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space(3),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadow,
  },
  counter: { flex: 1, alignItems: 'center', paddingHorizontal: space(2), gap: space(0.5) },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  // Carte d'appel : bleu nuit, halo bleu de marque.
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(5),
    borderRadius: radii.card,
    backgroundColor: colors.navy,
    overflow: 'hidden',
  },
  promoBlob: { width: 180, height: 180, top: -60, end: -50, backgroundColor: colors.primary, opacity: 0.6 },
  promoCta: {
    alignSelf: 'flex-start',
    marginTop: space(3),
    paddingHorizontal: space(4),
    paddingVertical: space(2),
    borderRadius: radii.chip,
    backgroundColor: colors.surface,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space(2) },
  list: { gap: space(3) },
  banner: { flexDirection: 'row', gap: space(2), padding: space(4), borderRadius: radii.input, backgroundColor: colors.warningSoft },
});
