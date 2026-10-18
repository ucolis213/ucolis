// Vérification transporteur (F3) : 5 pièces et 2 dates d'expiration, revues par le staff.

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CARRIER_DOCUMENT_KINDS, carrierVerificationSchema, type CarrierDocumentKind, type FileRef } from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '@/api/client';
import { useCarrierVerification } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Pill, type PillTone } from '@/components/Badge';
import { Button } from '@/components/Button';
import { notify } from '@/components/ConfirmDialog';
import { FileField } from '@/components/FileField';
import { DateSelect, SectionCard } from '@/components/FormBits';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatDate } from '@/format';
import { useSession } from '@/session/SessionContext';
import { colors, space } from '@/theme';

type Docs = Record<CarrierDocumentKind, FileRef | null>;
const NO_DOCS = Object.fromEntries(CARRIER_DOCUMENT_KINDS.map((k) => [k, null])) as Docs;

export default function CarrierVerification() {
  const { t } = useTranslation(['profile', 'common']);
  const query = useCarrierVerification();
  const qc = useQueryClient();
  const { refreshMe } = useSession();
  const [docs, setDocs] = useState<Docs>(NO_DOCS);
  const [licenseExpiresAt, setLicense] = useState<Date | null>(null);
  const [insuranceExpiresAt, setInsurance] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setFormError(null);
    const payload = { documents: docs, licenseExpiresAt, insuranceExpiresAt };
    const parsed = carrierVerificationSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await api.post('/me/carrier-verification', payload);
      notify(t('submitted'));
      setDocs(NO_DOCS);
      void qc.invalidateQueries({ queryKey: ['me', 'carrier-verification'] });
      void refreshMe();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('carrierVerification')} />}>
      <QueryView query={query}>
        {(v) => {
          const canSubmit = v.status !== 'pending' && v.status !== 'approved';
          const tone: PillTone = v.status === 'approved' ? 'success' : v.status === 'rejected' || v.status === 'expired' ? 'danger' : 'neutral';
          return (
            <View style={{ gap: space(4) }}>
              <SectionCard title={t('carrierVerification')} right={<Pill label={t(`verificationStatuses.${v.status}`)} tone={tone} />}>
                <AppText size="sm" color={colors.textMuted}>
                  {v.status === 'pending' ? t('underReview') : t('verificationIntro')}
                </AppText>
                {v.decisionReason && v.status === 'rejected' && (
                  <AppText size="sm" color={colors.danger}>
                    {t('rejectedReason', { reason: v.decisionReason })}
                  </AppText>
                )}
                {v.licenseExpiresAt && (
                  <AppText size="sm">
                    {t('licenseExpiresAt')} : {formatDate(v.licenseExpiresAt)}
                  </AppText>
                )}
                {v.insuranceExpiresAt && (
                  <AppText size="sm">
                    {t('insuranceExpiresAt')} : {formatDate(v.insuranceExpiresAt)}
                  </AppText>
                )}
              </SectionCard>

              {canSubmit && (
                <>
                  {CARRIER_DOCUMENT_KINDS.map((kind) => (
                    <FileField
                      key={kind}
                      label={t(`documents.${kind}`)}
                      value={docs[kind]}
                      onChange={(f) => setDocs((d) => ({ ...d, [kind]: f }))}
                      purpose="identity_doc"
                      error={errors[`documents.${kind}`]}
                    />
                  ))}
                  <DateSelect label={t('licenseExpiresAt')} value={licenseExpiresAt} onChange={setLicense} days={3650} error={errors.licenseExpiresAt} />
                  <DateSelect label={t('insuranceExpiresAt')} value={insuranceExpiresAt} onChange={setInsurance} days={730} error={errors.insuranceExpiresAt} />
                  {formError && <AppText color={colors.danger}>{formError}</AppText>}
                  <Button label={t('submitVerification')} onPress={submit} loading={submitting} />
                </>
              )}
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}
