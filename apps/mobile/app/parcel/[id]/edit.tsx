// Modifier une annonce : l'assistant s'ouvre pré-rempli (possible en open et negotiating).

import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useParcel } from '@/api/queries';
import { LoadingSkeleton } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { draftFromParcel } from '@/state/draftFromParcel';
import { useParcelDraft } from '@/state/parcelDraft';

export default function EditParcel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const parcel = useParcel(id);
  const start = useParcelDraft((s) => s.start);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (parcel.data) {
      start(draftFromParcel(parcel.data), parcel.data.id);
      setReady(true);
    }
  }, [parcel.data, start]);
  if (!ready) {
    return (
      <Screen>
        <LoadingSkeleton />
      </Screen>
    );
  }
  return <Redirect href="/parcel/new/route" />;
}
