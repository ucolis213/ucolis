// Publication (ou enregistrement d'une modification) du brouillon, en mode rapide comme complet.
// Les champs refusés par l'API sont rendus à l'écran appelant.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ParcelDto } from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '../api/client';
import { fullPayload, quickPayload } from '../state/draftPayload';
import { useParcelDraft } from '../state/parcelDraft';

export function usePublishParcel(onFieldErrors: (fields: Record<string, string>) => void) {
  const { t } = useTranslation(['parcel', 'errors']);
  const { draft, editingId, clear } = useParcelDraft();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  async function publish() {
    setPending(true);
    try {
      const body = draft.mode === 'quick' ? quickPayload(draft) : fullPayload(draft);
      const parcel = editingId
        ? await api.patch<ParcelDto>(`/parcels/${editingId}`, body)
        : await api.post<ParcelDto>('/parcels', body);
      clear();
      void qc.invalidateQueries({ queryKey: ['parcels'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
      router.dismissAll?.();
      router.replace({ pathname: '/parcel/[id]', params: { id: parcel.id } });
      if (!editingId) Alert.alert(t('published'));
    } catch (err) {
      const fields = fieldErrors(err);
      if (Object.keys(fields).length) {
        Alert.alert(t('errors:VALIDATION_ERROR'));
        onFieldErrors(fields);
      } else {
        Alert.alert(errorMessage(t, err));
      }
    } finally {
      setPending(false);
    }
  }

  return { publish, pending };
}
