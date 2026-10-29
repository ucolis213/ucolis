// Annonces (F7) : sélecteur Colis | Trajets, recherche, filtres en puces, tri, liste ou carte.

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import type { ParcelCardDto } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { useParcels, useTrips } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { HeaderBell } from '@/components/HeaderBell';
import { useTabBarSpace } from '@/components/TabBar';
import { ParcelCard } from '@/components/ParcelCard';
import { LoadingSkeleton } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { EmptyState, ErrorState } from '@/components/States';
import { TripCard } from '@/components/TripCard';
import { formatDate, placeLabel, price, wilayaName } from '@/format';
import { clusterByProximity } from '@/mapClusters';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { activeFilterKeys, useFilters, type ParcelFilters } from '@/state/filters';
import { colors, fontFamily, MIN_TOUCH, radii, routeArrow, shadow, space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function Listings() {
  const { t } = useTranslation(['common', 'parcel', 'trip']);
  const { scope, setScope } = useFilters();
  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <View style={styles.header}>
          <AppText size="xl" weight="bold" style={styles.flex}>
            {t('tabs.listings')}
          </AppText>
          <HeaderBell />
        </View>
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'parcels', label: t('trip:parcels') },
            { value: 'trips', label: t('trip:trips') },
          ]}
        />
      </View>
      {scope === 'parcels' ? <ParcelsPane /> : <TripsPane />}
    </Screen>
  );
}

function chipLabel(t: (k: string, o?: Record<string, unknown>) => string, key: keyof ParcelFilters, f: ParcelFilters) {
  switch (key) {
    case 'q':
      return `« ${f.q} »`;
    case 'fromWilaya':
      return `${t('common:from')} : ${wilayaName(f.fromWilaya!)}`;
    case 'toWilaya':
      return `${t('common:to')} : ${wilayaName(f.toWilaya!)}`;
    case 'maxWeight':
      return `≤ ${f.maxWeight} kg`;
    case 'vehicleType':
      return t(`parcel:vehicleTypes.${f.vehicleType}`);
    case 'urgent':
      return t('badges.urgent');
    case 'dateFrom':
      return `≥ ${formatDate(f.dateFrom!, { year: undefined })}`;
    case 'dateTo':
      return `≤ ${formatDate(f.dateTo!, { year: undefined })}`;
    case 'priceMin':
      return `≥ ${price(f.priceMin!)}`;
    case 'priceMax':
      return `≤ ${price(f.priceMax!)}`;
    case 'radiusKm':
      return `${f.radiusKm} km`;
    case 'proOnly':
      return t('badges.pro');
    case 'verifiedOnly':
      return t('badges.identity');
    default:
      return String(key);
  }
}

function ParcelsPane() {
  const { t } = useTranslation(['common', 'parcel']);
  const tabSpace = useTabBarSpace();
  const { parcels: filters, setParcels, removeParcelFilter, resetParcels, view, setView } = useFilters();
  const [q, setQ] = useState(filters.q ?? '');
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const query = useParcels(filters as unknown as Record<string, unknown>);
  const pull = usePullToRefresh(query.refetch);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const chips = activeFilterKeys(filters);

  useEffect(() => {
    const id = setTimeout(() => {
      if ((filters.q ?? '') !== q.trim()) setParcels({ q: q.trim() || undefined });
    }, 400);
    return () => clearTimeout(id);
  }, [q, filters.q, setParcels]);

  function toggleFavorite(p: ParcelCardDto) {
    requireAuth(async () => {
      await (p.isFavorite ? api.delete(`/me/favorites/${p.id}`) : api.put(`/me/favorites/${p.id}`));
      void queryClient.invalidateQueries({ queryKey: ['parcels'] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'favorites'] });
    });
  }

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={colors.textSubtle}
            maxLength={100}
            returnKeyType="search"
            style={[styles.flex, styles.searchInput, { fontFamily: fontFamily() }]}
          />
        </View>
        <Pressable style={styles.iconBtn} onPress={() => router.push('/search/filters')} accessibilityRole="button" accessibilityLabel={t('filters')}>
          <Ionicons name="options-outline" size={22} color={colors.navy} />
          {chips.length > 0 && <View style={styles.dot} />}
        </Pressable>
        <Pressable
          style={styles.iconBtn}
          onPress={() => setView(view === 'list' ? 'map' : 'list')}
          accessibilityRole="button"
          accessibilityLabel={view === 'list' ? t('parcel:map') : t('parcel:list')}
        >
          <Ionicons name={view === 'list' ? 'map-outline' : 'list-outline'} size={22} color={colors.navy} />
        </Pressable>
      </View>
      {chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsBar}
          contentContainerStyle={styles.chips}
        >
          {chips.map((k) => (
            <Pressable
              key={k}
              style={styles.chip}
              onPress={() => {
                removeParcelFilter(k);
                if (k === 'q') setQ('');
              }}
              accessibilityRole="button"
              accessibilityLabel={`${chipLabel(t, k, filters)} ✕`}
            >
              <AppText size="xs" weight="medium">
                {chipLabel(t, k, filters)}
              </AppText>
              <Ionicons name="close" size={14} color={colors.navy} />
            </Pressable>
          ))}
          <Pressable
            style={[styles.chip, styles.resetChip]}
            onPress={() => {
              resetParcels();
              setQ('');
            }}
            accessibilityRole="button"
          >
            <AppText size="xs" weight="semibold" color={colors.primaryDark}>
              {t('reset')}
            </AppText>
          </Pressable>
        </ScrollView>
      )}

      {query.isPending ? (
        <View style={styles.pad}>
          <LoadingSkeleton />
        </View>
      ) : query.isError ? (
        <ErrorState message={errorMessage(t, query.error)} onRetry={() => query.refetch()} />
      ) : view === 'map' ? (
        <ParcelsMap items={items} />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ ...styles.listContent, paddingBottom: tabSpace + space(2) }}
          ItemSeparatorComponent={() => <View style={{ height: space(3) }} />}
          renderItem={({ item }) => <ParcelCard parcel={item} onToggleFavorite={toggleFavorite} />}
          onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
          onEndReachedThreshold={0.5}
          {...pull}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title={t('parcel:noListings')}
              actionLabel={chips.length ? t('reset') : undefined}
              onAction={chips.length ? resetParcels : undefined}
            />
          }
        />
      )}
    </View>
  );
}

const INITIAL_REGION = { latitude: 33.5, longitude: 3, latitudeDelta: 10, longitudeDelta: 10 };
/** Largeur de la carte suivante visible au bord du carrousel. */
const PEEK = space(6);

/** Lieu commun d'un groupe : la commune, sinon la wilaya, sinon rien. */
function groupLabel(list: ParcelCardDto[]) {
  const first = list[0]!.pickup;
  if (list.every((p) => p.pickup.commune === first.commune)) return placeLabel(first);
  if (list.every((p) => p.pickup.wilayaCode === first.wilayaCode)) return wilayaName(first.wilayaCode);
  return null;
}

/**
 * Vue carte : départs regroupés selon le zoom (un groupe se sépare en zoomant, jusqu'aux adresses réelles).
 * Toucher un groupe ouvre toutes ses annonces dans un carrousel qui glisse horizontalement.
 */
function ParcelsMap({ items }: { items: ParcelCardDto[] }) {
  const { t } = useTranslation();
  const tabSpace = useTabBarSpace();
  const [span, setSpan] = useState({ latitudeDelta: INITIAL_REGION.latitudeDelta, longitudeDelta: INITIAL_REGION.longitudeDelta });
  const [selected, setSelected] = useState<{ key: string; items: ParcelCardDto[] } | null>(null);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const clusters = useMemo(
    () => clusterByProximity(items, span, (p) => p.pickup.location, (p) => p.id),
    [items, span],
  );
  const cardWidth = Math.max(0, width - PEEK);
  const interval = cardWidth + space(3);

  function open(key: string, list: ParcelCardDto[]) {
    setSelected({ key, items: list });
    setIndex(0);
  }

  return (
    <View style={styles.flex}>
      <MapView
        style={styles.flex}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={(r) => setSpan({ latitudeDelta: r.latitudeDelta, longitudeDelta: r.longitudeDelta })}
      >
        {clusters.map((c) => {
          const on = selected?.key === c.key;
          return (
            <Marker
              key={c.key}
              coordinate={{ latitude: c.center.lat, longitude: c.center.lng }}
              onPress={() => open(c.key, c.items)}
              accessibilityLabel={groupLabel(c.items) ?? String(c.items.length)}
            >
              <View style={[styles.cluster, on && styles.clusterOn]}>
                {c.items.length === 1 ? (
                  <Ionicons name="cube" size={14} color="#FFFFFF" />
                ) : (
                  <AppText size="xs" weight="bold" color="#FFFFFF">
                    {c.items.length}
                  </AppText>
                )}
              </View>
            </Marker>
          );
        })}
      </MapView>
      {selected && (
        <View style={[styles.preview, { bottom: tabSpace + space(1) }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={styles.previewHeader}>
            <AppText weight="bold" numberOfLines={1} style={styles.flex}>
              {groupLabel(selected.items) ?? t('tabs.listings')}
            </AppText>
            {selected.items.length > 1 && (
              <AppText size="sm" weight="semibold" color={colors.textMuted}>
                {index + 1} / {selected.items.length}
              </AppText>
            )}
            <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
              <Ionicons name="close" size={20} color={colors.navy} />
            </Pressable>
          </View>
          {cardWidth > 0 && (
            <FlatList
              key={selected.key}
              data={selected.items}
              keyExtractor={(p) => p.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={interval}
              decelerationRate="fast"
              disableIntervalMomentum
              contentContainerStyle={styles.carousel}
              onMomentumScrollEnd={(e) =>
                setIndex(Math.min(selected.items.length - 1, Math.max(0, Math.round(Math.abs(e.nativeEvent.contentOffset.x) / interval))))
              }
              renderItem={({ item }) => (
                <View style={[styles.slide, { width: selected.items.length > 1 ? cardWidth : width }]}>
                  <ParcelCard parcel={item} fill />
                </View>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

function TripsPane() {
  const { t } = useTranslation(['trip', 'common']);
  const tabSpace = useTabBarSpace();
  const { trips: filters, resetTrips } = useFilters();
  const query = useTrips(filters as Record<string, unknown>);
  const pull = usePullToRefresh(query.refetch);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const active = Object.values(filters).some(Boolean);
  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <Pressable style={[styles.search, styles.flex]} onPress={() => router.push({ pathname: '/search/filters', params: { scope: 'trips' } })} accessibilityRole="button">
          <Ionicons name="options-outline" size={18} color={colors.textMuted} />
          <AppText color={active ? colors.navy : colors.textSubtle} numberOfLines={1} style={styles.flex}>
            {active
              ? [filters.fromWilaya && wilayaName(filters.fromWilaya), filters.toWilaya && wilayaName(filters.toWilaya)].filter(Boolean).join(` ${routeArrow()} `) || t('common:filters')
              : t('common:filters')}
          </AppText>
          {active && (
            <Pressable onPress={resetTrips} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common:reset')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </Pressable>
      </View>
      {query.isPending ? (
        <View style={styles.pad}>
          <LoadingSkeleton />
        </View>
      ) : query.isError ? (
        <ErrorState message={errorMessage(t, query.error)} onRetry={() => query.refetch()} />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ ...styles.listContent, paddingBottom: tabSpace + space(2) }}
          ItemSeparatorComponent={() => <View style={{ height: space(3) }} />}
          renderItem={({ item }) => <TripCard trip={item} />}
          onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
          {...pull}
          ListEmptyComponent={<EmptyState icon="car-outline" title={t('noTrips')} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: space(5), paddingTop: space(3), gap: space(3) },
  header: { flexDirection: 'row', alignItems: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(5), paddingVertical: space(3) },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    minHeight: MIN_TOUCH,
    paddingHorizontal: space(3),
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadow,
  },
  searchInput: { color: colors.navy, minHeight: MIN_TOUCH, textAlign: 'auto' },
  iconBtn: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radii.card, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  dot: { position: 'absolute', top: 8, end: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  // Sans flexGrow: 0, un ScrollView horizontal prend toute la hauteur libre et étire les puces.
  chipsBar: { flexGrow: 0 },
  chips: { alignItems: 'center', paddingHorizontal: space(5), paddingBottom: space(2), gap: space(2) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingHorizontal: space(3),
    minHeight: 32,
    borderRadius: radii.chip,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetChip: { borderColor: colors.primary },
  pad: { padding: space(5) },
  listContent: { padding: space(5), paddingTop: space(1) },
  cluster: { minWidth: 32, height: 32, paddingHorizontal: 6, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  clusterOn: { backgroundColor: colors.navy },
  preview: { position: 'absolute', start: space(4), end: space(4), gap: space(2) },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(3), borderRadius: radii.input, backgroundColor: colors.surface },
  // Cellules étirées à la hauteur de la plus haute carte : toutes les cartes ont la même taille.
  carousel: { gap: space(3), alignItems: 'stretch' },
  slide: { flex: 1 },
});
