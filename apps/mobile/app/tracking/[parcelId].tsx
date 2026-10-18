// Lien profond ucolis://tracking/<parcelId> : redirection vers l'écran de suivi du colis.

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TrackingLink() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  return <Redirect href={{ pathname: '/parcel/[id]/tracking', params: { id: parcelId } }} />;
}
