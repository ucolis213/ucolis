// Recharger mon compte : coordonnées de virement (CCP, BaridiMob), montant et preuve, puis suivi des demandes.
// Le solde n'est crédité qu'après vérification du virement par le staff.

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TOPUP_METHODS, type FileRef, type TopUpDto, type TopUpMethod } from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '@/api/client';
import { useMyTopUps, useWallet } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Pill, type PillTone } from '@/components/Badge';
import { Button } from '@/components/Button';
import { notify } from '@/components/ConfirmDialog';
import { FileField } from '@/components/FileField';
import { KeyValue, PriceInput, SectionCard } from '@/components/FormBits';
import { useCommission } from '@/components/CommissionBreakdown';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { TextField } from '@/components/TextField';
import { formatDate, price } from '@/format';
import { colors, space } from '@/theme';

const TONES: Record<TopUpDto['status'], PillTone> = { pending: 'neutral', approved: 'success', rejected: 'danger' };

export default function WalletTopUp() {
  const { t } = useTranslation(['wallet', 'common', 'errors']);
  const settings = useCommission();
  const wallet = useWallet();
  const topUps = useMyTopUps();
  const qc = useQueryClient();
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<TopUpMethod>('baridimob');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<FileRef | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!settings) return;
    const { minAmount, maxAmount } = settings.topUp;
    const e: Record<string, string> = {};
    if (!amount || amount < minAmount || amount > maxAmount) e.amount = 'validation.topUpAmount';
    if (!proof) e.proof = 'validation.required';
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      await api.post('/me/wallet/topups', { amount, method, reference: reference.trim() || undefined, proof });
      notify(t('sent'));
      setAmount(null);
      setReference('');
      setProof(null);
      void qc.invalidateQueries({ queryKey: ['me', 'wallet'] });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  const pending = wallet.data?.pendingTopUp;

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('topUp')} />}>
      {settings && !pending && (
        <View style={{ gap: space(4) }}>
          <AppText size="sm" color={colors.textMuted}>
            {t('topUpIntro')}
          </AppText>
          <SectionCard>
            <KeyValue label={t('holder')} value={settings.topUp.holderName} />
            <KeyValue label={t('ccp')} value={`${settings.topUp.ccpAccount} · ${t('ccpKey')} ${settings.topUp.ccpKey}`} />
            <KeyValue label={t('rip')} value={<AppText size="sm" weight="medium" selectable>{settings.topUp.baridiMobRip}</AppText>} />
          </SectionCard>
          <AppText weight="semibold">{t('method')}</AppText>
          <Segmented value={method} onChange={setMethod} options={TOPUP_METHODS.map((m) => ({ value: m, label: t(`methods.${m}`) }))} />
          <PriceInput
            label={t('amount')}
            value={amount}
            onChange={setAmount}
            error={errors.amount}
            hint={t('amountHint', { min: price(settings.topUp.minAmount), max: price(settings.topUp.maxAmount) })}
          />
          <TextField label={t('reference')} value={reference} onChangeText={setReference} maxLength={60} autoCapitalize="characters" />
          <FileField label={t('proof')} value={proof} onChange={setProof} purpose="topup_proof" error={errors.proof} />
          {formError && <AppText color={colors.danger}>{formError}</AppText>}
          <Button label={t('send')} onPress={submit} loading={submitting} />
        </View>
      )}
      {pending && (
        <SectionCard>
          <AppText size="sm">{t('pending', { amount: price(pending.amount) })}</AppText>
        </SectionCard>
      )}

      <AppText weight="bold">{t('myTopUps')}</AppText>
      <QueryView query={topUps} isEmpty={(d) => d.items.length === 0} empty={{ icon: 'receipt-outline', title: t('noTransactions') }}>
        {(d) => (
          <View style={{ gap: space(3) }}>
            {d.items.map((r) => (
              <SectionCard key={r.id} title={price(r.amount)} right={<Pill label={t(`topUpStatuses.${r.status}`)} tone={TONES[r.status]} />}>
                <AppText size="xs" color={colors.textMuted}>
                  {`${t(`methods.${r.method}`)} · ${formatDate(r.createdAt)}${r.reference ? ` · ${r.reference}` : ''}`}
                </AppText>
                {r.creditedAmount !== null && <AppText size="sm">{t('credited', { amount: price(r.creditedAmount) })}</AppText>}
                {r.status === 'rejected' && r.decisionReason && (
                  <AppText size="sm" color={colors.danger}>
                    {t('rejectedReason', { reason: r.decisionReason })}
                  </AppText>
                )}
              </SectionCard>
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
