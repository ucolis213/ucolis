// Étape 1 de la publication complète : adresses de départ et d'arrivée ; wilaya et commune déduites de
// l'adresse choisie ; précisions libres. Retour possible à la publication rapide.

import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { RoutePicker } from '@/components/RoutePicker';
import { WizardFrame } from '@/components/WizardFrame';
import { stepErrors } from '@/state/draftPayload';
import { useParcelDraft } from '@/state/parcelDraft';

export default function RouteStep() {
  const { t } = useTranslation('parcel');
  const { draft, update, editingId, editingQuick } = useParcelDraft();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function next() {
    const e = stepErrors('route', draft);
    setErrors(e);
    if (Object.keys(e).length === 0) router.push('/parcel/new/details');
  }

  // Une annonce déjà complète ne repasse pas en mode rapide.
  const canGoQuick = !editingId || editingQuick;

  return (
    <WizardFrame step="route" onNext={next}>
      <RoutePicker errors={errors} showDetails />
      {canGoQuick && (
        <Button
          label={t('quickPublish')}
          variant="ghost"
          icon="flash-outline"
          onPress={() => {
            update({ mode: 'quick' });
            router.replace('/parcel/new/quick');
          }}
        />
      )}
    </WizardFrame>
  );
}
