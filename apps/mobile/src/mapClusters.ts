// Regroupement des annonces sur la carte selon le zoom : deux annonces se rejoignent quand leurs points sont
// plus proches qu'une fraction de la zone affichée. En zoomant, les groupes se séparent jusqu'aux adresses
// réelles ; des annonces au même point restent groupées à tout zoom.

import type { LatLng } from '@ucolis/shared';

export interface MapSpan {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapCluster<T> {
  /** Stable tant que le groupe garde la même première annonce. */
  key: string;
  center: LatLng;
  items: T[];
}

/** Part de la largeur affichée sous laquelle deux points se regroupent (environ la taille d'une bulle). */
export const CLUSTER_RATIO = 0.08;

export function clusterByProximity<T>(
  items: T[],
  span: MapSpan,
  pointOf: (item: T) => LatLng,
  keyOf: (item: T) => string,
): MapCluster<T>[] {
  const maxLat = span.latitudeDelta * CLUSTER_RATIO;
  const maxLng = span.longitudeDelta * CLUSTER_RATIO;
  const clusters: (MapCluster<T> & { sumLat: number; sumLng: number })[] = [];
  for (const item of items) {
    const p = pointOf(item);
    const near = clusters.find(
      (c) => Math.abs(c.center.lat - p.lat) <= maxLat && Math.abs(c.center.lng - p.lng) <= maxLng,
    );
    if (near) {
      near.items.push(item);
      near.sumLat += p.lat;
      near.sumLng += p.lng;
      near.center = { lat: near.sumLat / near.items.length, lng: near.sumLng / near.items.length };
    } else {
      clusters.push({ key: keyOf(item), center: p, items: [item], sumLat: p.lat, sumLng: p.lng });
    }
  }
  return clusters.map(({ key, center, items: list }) => ({ key, center, items: list }));
}
