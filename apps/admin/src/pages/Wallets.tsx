// Portefeuilles des transporteurs : recharges à vérifier (la plus ancienne en premier, preuve en URL signée),
// soldes (les plus bas en premier) et ajustements motivés. Le prélèvement des commissions est automatique.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { TOPUP_STATUSES, type TopUpDto, type TopUpStatus, type WalletTransactionDto } from '@ucolis/shared';
import { api } from '../api/client';
import { useAction, useAdminQuery, type Page } from '../api/hooks';
import { DocumentViewer } from '../components/domain';
import { Button, Card, Filters, Input, KeyValue, PageHeader, Pagination, Pill, QueryState, ReasonDialog, SelectField, Table, Tabs, type Tone } from '../components/ui';
import { dateTime, price, t, wilaya } from '../format';
import { useListParams } from '../hooks/useListParams';

type TopUpRow = TopUpDto & { userId: string; userName: string };
interface WalletRow {
  userId: string;
  name: string;
  wilayaCode: string | null;
  balance: number;
  updatedAt: string;
}

const STATUS_TONES: Record<TopUpStatus, Tone> = { pending: 'warning', approved: 'success', rejected: 'danger' };

function TopUpPill({ status }: { status: TopUpStatus }) {
  return <Pill tone={STATUS_TONES[status]}>{t(`wallet.topUpStatuses.${status}`)}</Pill>;
}

function Amount({ value }: { value: number }) {
  return <span className={value < 0 ? 'font-semibold text-danger' : 'font-semibold'}>{price(value)}</span>;
}

const KEYS = ['tab', 'status', 'q', 'blocked'] as const;

export function Wallets() {
  const list = useListParams(KEYS);
  const tab = list.values.tab === 'balances' ? 'balances' : 'topups';
  return (
    <div>
      <PageHeader title="Portefeuilles">
        <p className="text-sm text-muted">
          Les commissions sont prélevées automatiquement à chaque livraison. Activation, grille et coordonnées de virement : Réglages, clé « commission ».
        </p>
      </PageHeader>
      <Tabs
        value={tab}
        onChange={(k) => list.set({ tab: k === 'topups' ? '' : k, status: '', q: '', blocked: '' })}
        tabs={[
          { key: 'topups', label: 'Recharges' },
          { key: 'balances', label: 'Soldes' },
        ]}
      />
      {tab === 'topups' ? <TopUps list={list} /> : <Balances list={list} />}
    </div>
  );
}

function TopUps({ list }: { list: ReturnType<typeof useListParams<(typeof KEYS)[number]>> }) {
  const navigate = useNavigate();
  const status = (list.values.status || 'pending') as TopUpStatus;
  const query = useAdminQuery<Page<TopUpRow>>(['wallets', 'topups', status, list.page], `/wallets/topups${list.query({ status, tab: undefined, q: undefined, blocked: undefined })}`, { paginated: true });
  return (
    <Card>
      <Filters>
        <SelectField label="Statut" value={status} onChange={(e) => list.set({ status: e.target.value === 'pending' ? '' : e.target.value })} options={TOPUP_STATUSES.map((s) => ({ value: s, label: t(`wallet.topUpStatuses.${s}`) }))} />
      </Filters>
      <QueryState query={query}>
        {(data) => (
          <>
            <Table
              rows={data.items}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/wallets/topups/${r.id}`)}
              empty="Aucune demande."
              columns={[
                { header: 'Transporteur', cell: (r) => r.userName },
                { header: 'Montant déclaré', cell: (r) => price(r.amount) },
                { header: 'Moyen', cell: (r) => t(`wallet.methods.${r.method}`) },
                { header: 'Référence', cell: (r) => r.reference ?? '-' },
                { header: 'Envoyée le', cell: (r) => dateTime(r.createdAt) },
                { header: 'Statut', cell: (r) => <TopUpPill status={r.status} /> },
              ]}
            />
            <Pagination page={data.page} limit={data.limit} total={data.total} onPage={list.setPage} />
          </>
        )}
      </QueryState>
    </Card>
  );
}

function Balances({ list }: { list: ReturnType<typeof useListParams<(typeof KEYS)[number]>> }) {
  const navigate = useNavigate();
  const v = list.values;
  const query = useAdminQuery<Page<WalletRow>>(['wallets', 'list', v.q, v.blocked, list.page], `/wallets${list.query({ tab: undefined, status: undefined })}`, { paginated: true });
  return (
    <Card>
      <Filters>
        <Input label="Recherche" placeholder="Nom ou email" defaultValue={v.q} onKeyDown={(e) => e.key === 'Enter' && list.set({ q: e.currentTarget.value })} onBlur={(e) => list.set({ q: e.target.value })} />
        <SelectField
          label="Solde"
          value={v.blocked}
          onChange={(e) => list.set({ blocked: e.target.value })}
          placeholder="Tous"
          options={[
            { value: 'true', label: 'Sous le seuil (bloqués)' },
            { value: 'false', label: 'Au-dessus du seuil' },
          ]}
        />
      </Filters>
      <QueryState query={query}>
        {(data) => (
          <>
            <Table
              rows={data.items}
              rowKey={(r) => r.userId}
              onRowClick={(r) => navigate(`/wallets/${r.userId}`)}
              empty="Aucun portefeuille."
              columns={[
                { header: 'Transporteur', cell: (r) => r.name },
                { header: 'Wilaya', cell: (r) => wilaya(r.wilayaCode) },
                { header: 'Solde', cell: (r) => <Amount value={r.balance} /> },
                { header: 'Dernier mouvement', cell: (r) => dateTime(r.updatedAt) },
              ]}
            />
            <Pagination page={data.page} limit={data.limit} total={data.total} onPage={list.setPage} />
          </>
        )}
      </QueryState>
    </Card>
  );
}

interface TopUpDetailDto extends TopUpRow {
  balance: number;
  proof: { kind: 'image' | 'pdf'; url: string } | null;
}

export function TopUpDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const key = ['wallets', 'topup', id];
  const query = useAdminQuery<TopUpDetailDto>(key, `/wallets/topups/${id}`);
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [amount, setAmount] = useState('');
  const decide = useAction(
    (body: { decision: 'approve' | 'reject'; amount?: number; reason?: string }) => api.post(`/wallets/topups/${id}/decision`, body),
    [key, ['wallets'], ['stats']],
  );
  return (
    <QueryState query={query}>
      {(d) => (
        <div className="space-y-6">
          <PageHeader title={`Recharge de ${d.userName}`} back="/wallets">
            <TopUpPill status={d.status} />
          </PageHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Demande">
              <KeyValue
                items={[
                  ['Transporteur', <Link key="u" className="text-primary-dark underline" to={`/wallets/${d.userId}`}>{d.userName}</Link>],
                  ['Montant déclaré', price(d.amount)],
                  ['Moyen', t(`wallet.methods.${d.method}`)],
                  ['Référence', d.reference ?? '-'],
                  ['Envoyée le', dateTime(d.createdAt)],
                  ['Solde actuel', <Amount key="b" value={d.balance} />],
                  ...(d.creditedAmount !== null ? ([['Montant crédité', price(d.creditedAmount)]] as [string, string][]) : []),
                  ...(d.decisionReason ? ([['Motif', d.decisionReason]] as [string, string][]) : []),
                  ...(d.decidedAt ? ([['Traitée le', dateTime(d.decidedAt)]] as [string, string][]) : []),
                ]}
              />
            </Card>
            <DocumentViewer title="Preuve de virement" file={d.proof} />
          </div>
          {d.status === 'pending' && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setAmount(String(d.amount));
                  setDialog('approve');
                }}
              >
                Valider et créditer
              </Button>
              <Button variant="danger" onClick={() => setDialog('reject')}>
                Refuser
              </Button>
            </div>
          )}
          <ReasonDialog
            open={dialog === 'approve'}
            title="Créditer le portefeuille"
            description="Vérifiez que le virement apparaît sur le compte avant de créditer. Corrigez le montant s’il diffère de la déclaration."
            reasonLabel="Note (facultative)"
            optionalReason
            confirmLabel="Créditer"
            extra={<Input label="Montant reçu (DA)" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />}
            onClose={() => setDialog(null)}
            onConfirm={(reason) =>
              decide.mutateAsync({ decision: 'approve', amount: Number(amount), ...(reason ? { reason } : {}) }).then(() => navigate('/wallets'))
            }
          />
          <ReasonDialog
            open={dialog === 'reject'}
            title="Refuser la recharge"
            description="Le motif est envoyé au transporteur, qui pourra faire une nouvelle demande."
            reasonLabel="Motif du refus (visible par l’utilisateur)"
            confirmLabel="Refuser"
            danger
            onClose={() => setDialog(null)}
            onConfirm={(reason) => decide.mutateAsync({ decision: 'reject', reason }).then(() => navigate('/wallets'))}
          />
        </div>
      )}
    </QueryState>
  );
}

interface WalletDetailDto {
  userId: string;
  name: string;
  balance: number | null;
  transactions: WalletTransactionDto[];
  topUps: TopUpDto[];
}

export function WalletDetail() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const key = ['wallets', 'detail', userId];
  const query = useAdminQuery<WalletDetailDto>(key, `/wallets/${userId}`);
  const [adjusting, setAdjusting] = useState(false);
  const [amount, setAmount] = useState('');
  const adjust = useAction((body: { amount: number; reason: string }) => api.post(`/wallets/${userId}/adjust`, body), [key, ['wallets'], ['stats']]);
  return (
    <QueryState query={query}>
      {(d) => (
        <div className="space-y-6">
          <PageHeader
            title={`Portefeuille de ${d.name}`}
            back="/wallets?tab=balances"
            actions={
              <Button
                variant="outline"
                onClick={() => {
                  setAmount('');
                  setAdjusting(true);
                }}
              >
                Ajuster le solde
              </Button>
            }
          >
            <Link className="text-sm text-primary-dark underline" to={`/users/${d.userId}`}>
              Fiche utilisateur
            </Link>
          </PageHeader>
          <Card title="Solde">
            <div className="text-3xl font-bold">{d.balance === null ? 'Portefeuille non ouvert' : <Amount value={d.balance} />}</div>
          </Card>
          <Card title="Mouvements (100 derniers)">
            <Table
              rows={d.transactions}
              rowKey={(r) => r.id}
              empty="Aucun mouvement."
              columns={[
                { header: 'Date', cell: (r) => dateTime(r.createdAt) },
                { header: 'Type', cell: (r) => t(`wallet.types.${r.type}`) },
                { header: 'Montant', cell: (r) => <Amount value={r.amount} /> },
                { header: 'Solde après', cell: (r) => <Amount value={r.balanceAfter} /> },
                {
                  header: 'Référence',
                  cell: (r) =>
                    r.parcel ? (
                      <button className="text-primary-dark underline" onClick={() => navigate(`/parcels/${r.parcel!.id}`)}>
                        {r.parcel.reference}
                      </button>
                    ) : (
                      (r.note ?? '-')
                    ),
                },
              ]}
            />
          </Card>
          <Card title="Demandes de recharge">
            <Table
              rows={d.topUps}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/wallets/topups/${r.id}`)}
              empty="Aucune demande."
              columns={[
                { header: 'Envoyée le', cell: (r) => dateTime(r.createdAt) },
                { header: 'Montant', cell: (r) => price(r.amount) },
                { header: 'Crédité', cell: (r) => price(r.creditedAmount) },
                { header: 'Statut', cell: (r) => <TopUpPill status={r.status} /> },
              ]}
            />
          </Card>
          <ReasonDialog
            open={adjusting}
            title="Ajuster le solde"
            description="Montant positif pour créditer, négatif pour débiter. Le motif apparaît dans l’historique du transporteur."
            reasonLabel="Motif (visible par le transporteur)"
            confirmLabel="Appliquer"
            extra={<Input label="Montant (DA)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />}
            onClose={() => setAdjusting(false)}
            onConfirm={(reason) => adjust.mutateAsync({ amount: Number(amount), reason })}
          />
        </div>
      )}
    </QueryState>
  );
}
