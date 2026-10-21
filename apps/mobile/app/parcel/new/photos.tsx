// Étape 4 : jusqu'à 5 photos facultatives (galerie ou caméra), compressées, envoyées par upload signé,
// réordonnables.

import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { PhotoGrid } from '@/components/PhotoGrid';
import { WizardFrame } from '@/components/WizardFrame';
import { stepErrors } from '@/state/draftPayload';
import { useParcelDraft } from '@/state/parcelDraft';
import { colors } from '@/theme';

export default function PhotosStep() {
  const { t } = useTranslation(['parcel', 'errors']);
  const { draft, update } = useParcelDraft();
  const [error, setError] = useState<string | null>(null);

  function next() {
    const e = stepErrors('photos', draft);
    setError(e.photos ?? null);
    if (!e.photos) router.push('/parcel/new/review');
  }

  return (
    <WizardFrame step="photos" onNext={next}>
      <AppText size="sm" color={colors.textMuted}>
        {t('photosOptionalHint')}
      </AppText>
      <PhotoGrid photos={draft.photos} onChange={(photos) => update({ photos })} />
      {error && (
        <AppText size="sm" color={colors.danger}>
          {t(`errors:${error}`)}
        </AppText>
      )}
    </WizardFrame>
  );
}
