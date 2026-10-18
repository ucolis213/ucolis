// Statut professionnel (F4) : dossier RC/NIF soumis au staff, bannières d'état, renvoi après refus.

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LEGAL_FORMS, proApplicationSchema, type FileRef } from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '@/api/client';
import { usePro } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { notify } from '@/components/ConfirmDialog';
import { FileField } from '@/components/FileField';
import { SectionCard } from '@/components/FormBits';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Select } from '@/components/Select';
import { Pill } from '@/components/Badge';
import { TextField } from '@/components/TextField';
import { WilayaCommuneSelect } from '@/components/WilayaCommuneSelect';
import { useSession } from '@/session/SessionContext';
import { colors, space } from '@/theme';

type Form = {
  companyName: string;
  legalForm: string;
  rcNumber: string;
  rcDocument: FileRef | null;
  nif: string;
  nifDocument: FileRef | null;
  nis: string;
  address: string;
  place: { wilayaCode: string; commune: string };
  logo: FileRef | null;
};

const EMPTY: Form = {
  companyName: '',
  legalForm: '',
  rcNumber: '',
  rcDocument: null,
  nif: '',
  nifDocument: null,
  nis: '',
  address: '',
  place: { wilayaCode: '', commune: '' },
  logo: null,
};

export default function ProStatus() {
  const { t } = useTranslation(['profile', 'common']);
  const query = usePro();
  const { refreshMe } = useSession();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...(f ?? EMPTY), [k]: v }));

  async function submit() {
    if (!form) return;
    setFormError(null);
    const payload = { ...form, nis: form.nis || undefined };
    const parsed = proApplicationSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await api.post('/me/pro', parsed.data);
      notify(t('submitted'));
      setForm(null);
      void qc.invalidateQueries({ queryKey: ['me', 'pro'] });
      void refreshMe();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('proStatus')} />}>
      <QueryView query={query}>
        {(pro) => {
          const canApply = !pro.underReview && pro.status !== 'approved';
          const startForm = () =>
            setForm(
              pro.application
                ? {
                    ...EMPTY,
                    ...pro.application,
                    nis: pro.application.nis ?? '',
                    place: { wilayaCode: pro.application.wilayaCode, commune: pro.application.commune },
                  }
                : EMPTY,
            );
          return (
            <View style={{ gap: space(4) }}>
              <SectionCard title={t('proStatus')} right={<Pill label={t(`proStatuses.${pro.underReview ? 'pending' : pro.status}`)} tone={pro.status === 'approved' ? 'success' : pro.status === 'rejected' || pro.status === 'revoked' ? 'danger' : 'neutral'} />}>
                {pro.underReview ? (
                  <AppText size="sm">{t('underReview')}</AppText>
                ) : pro.status === 'approved' ? (
                  <AppText size="sm">{pro.application?.companyName}</AppText>
                ) : (
                  <AppText size="sm" color={colors.textMuted}>
                    {t('proIntro')}
                  </AppText>
                )}
                {pro.decisionReason && (pro.status === 'rejected' || pro.status === 'revoked') && (
                  <AppText size="sm" color={colors.danger}>
                    {t('rejectedReason', { reason: pro.decisionReason })}
                  </AppText>
                )}
              </SectionCard>

              {canApply && !form && <Button label={pro.status === 'none' ? t('becomePro') : t('fixAndResend')} onPress={startForm} />}

              {form && (
                <View style={{ gap: space(4) }}>
                  <TextField label={t('companyName')} value={form.companyName} onChangeText={(v) => set('companyName', v)} error={errors.companyName} maxLength={100} />
                  <Select
                    label={t('legalForm')}
                    value={form.legalForm || undefined}
                    options={LEGAL_FORMS.map((v) => ({ value: v, label: t(`legalForms.${v}`) }))}
                    onChange={(v) => set('legalForm', v)}
                    error={errors.legalForm}
                  />
                  <TextField label={t('rcNumber')} value={form.rcNumber} onChangeText={(v) => set('rcNumber', v)} error={errors.rcNumber} autoCapitalize="characters" />
                  <FileField label={t('rcDocument')} value={form.rcDocument} onChange={(f) => set('rcDocument', f)} purpose="pro_doc" error={errors.rcDocument} />
                  <TextField label={t('nif')} value={form.nif} onChangeText={(v) => set('nif', v.replace(/\D/g, '').slice(0, 15))} error={errors.nif} keyboardType="number-pad" />
                  <FileField label={t('nifDocument')} value={form.nifDocument} onChange={(f) => set('nifDocument', f)} purpose="pro_doc" error={errors.nifDocument} />
                  <TextField label={t('nis')} value={form.nis} onChangeText={(v) => set('nis', v)} error={errors.nis} />
                  <TextField label={t('address')} value={form.address} onChangeText={(v) => set('address', v)} error={errors.address} maxLength={200} />
                  <WilayaCommuneSelect
                    value={form.place}
                    onChange={(p) => set('place', p)}
                    errors={{ wilaya: errors['place.wilayaCode'], commune: errors['place.commune'] }}
                  />
                  <FileField label={t('logo')} value={form.logo} onChange={(f) => set('logo', f)} purpose="avatar" />
                  {formError && <AppText color={colors.danger}>{formError}</AppText>}
                  <Button label={t('submit')} onPress={submit} loading={submitting} />
                  <Button label={t('common:cancel')} variant="ghost" onPress={() => setForm(null)} />
                </View>
              )}
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}
