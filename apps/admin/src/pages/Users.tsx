import { useNavigate } from 'react-router';
import { INTENTS, USER_STATUSES, WILAYAS } from '@ucolis/shared';
import { downloadCsv, qs } from '../api/client';
import { useAdminQuery, type Page } from '../api/hooks';
import { useSession } from '../auth/session';
import { UserStatusPill, VerificationPill } from '../components/domain';
import { Button, Card, Filters, Input, PageHeader, Pagination, QueryState, SelectField, Table } from '../components/ui';
import { date, INTENT_LABELS, USER_STATUS_LABELS, wilaya } from '../format';
import { useListParams } from '../hooks/useListParams';

export interface AdminUserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  wilayaCode: string;
  commune: string;
  intent: string;
  accountType: 'individual' | 'professional';
  status: string;
  emailVerified: boolean;
  carrierVerification: string;
  proStatus: string;
  companyName: string | null;
  rating: { average: number; count: number };
  stats: { parcelsSent: number; parcelsCarried: number; withdrawals: number; disputesLost: number; successRate: number | null };
  suspension: { reason: string | null; until: string | null; at: string | null } | null;
  lastSeenAt: string | null;
  createdAt: string;
}

const KEYS = ['q', 'status', 'intent', 'accountType', 'wilayaCode', 'verified'] as const;
export const WILAYA_OPTIONS = WILAYAS.map((w) => ({ value: w.code, label: `${w.code} · ${w.fr}` }));

export function Users() {
  const list = useListParams(KEYS);
  const navigate = useNavigate();
  const { can } = useSession();
  const query = useAdminQuery<Page<AdminUserRow>>(['users', list.values, list.page], `/users${list.query()}`, { paginated: true });
  const v = list.values;

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        actions={
          <Button variant="outline" onClick={() => void downloadCsv(`/users${qs({ ...v, format: 'csv' })}`, 'utilisateurs.csv')}>
            Exporter en CSV
          </Button>
        }
      >
        {!can('users.view_pii') && <p className="text-sm text-muted">Email et téléphone sont masqués (permission « données personnelles » absente), y compris dans l’export.</p>}
      </PageHeader>
      <Card>
        <Filters>
          <Input label="Recherche" placeholder={can('users.view_pii') ? 'Nom, entreprise, email, téléphone' : 'Nom ou entreprise'} defaultValue={v.q} onKeyDown={(e) => e.key === 'Enter' && list.set({ q: e.currentTarget.value })} onBlur={(e) => list.set({ q: e.target.value })} />
          <SelectField label="Statut" value={v.status} onChange={(e) => list.set({ status: e.target.value })} placeholder="Tous" options={USER_STATUSES.map((s) => ({ value: s, label: USER_STATUS_LABELS[s] ?? s }))} />
          <SelectField label="Profil" value={v.intent} onChange={(e) => list.set({ intent: e.target.value })} placeholder="Tous" options={INTENTS.map((s) => ({ value: s, label: INTENT_LABELS[s] ?? s }))} />
          <SelectField
            label="Type de compte"
            value={v.accountType}
            onChange={(e) => list.set({ accountType: e.target.value })}
            placeholder="Tous"
            options={[
              { value: 'individual', label: 'Particulier' },
              { value: 'professional', label: 'Professionnel' },
            ]}
          />
          <SelectField label="Wilaya" value={v.wilayaCode} onChange={(e) => list.set({ wilayaCode: e.target.value })} placeholder="Toutes" options={WILAYA_OPTIONS} />
          <SelectField
            label="Transporteur vérifié"
            value={v.verified}
            onChange={(e) => list.set({ verified: e.target.value })}
            placeholder="Indifférent"
            options={[
              { value: 'true', label: 'Oui' },
              { value: 'false', label: 'Non' },
            ]}
          />
        </Filters>
        <QueryState query={query}>
          {(data) => (
            <>
              <Table
                rows={data.items}
                rowKey={(u) => u.id}
                onRowClick={(u) => navigate(`/users/${u.id}`)}
                columns={[
                  { header: 'Nom', cell: (u) => <div><div className="font-medium">{u.firstName} {u.lastName}</div>{u.companyName && <div className="text-xs text-muted">{u.companyName}</div>}</div> },
                  { header: 'Contact', cell: (u) => <div className="text-xs"><div>{u.email}</div><div>{u.phone}</div></div> },
                  { header: 'Wilaya', cell: (u) => wilaya(u.wilayaCode) },
                  { header: 'Profil', cell: (u) => INTENT_LABELS[u.intent] ?? u.intent },
                  { header: 'Vérifications', cell: (u) => <div className="flex flex-col gap-1"><VerificationPill kind="identity" status={u.carrierVerification} />{u.proStatus !== 'none' && <VerificationPill kind="pro" status={u.proStatus} />}</div> },
                  { header: 'Statut', cell: (u) => <UserStatusPill status={u.status} /> },
                  { header: 'Inscrit le', cell: (u) => date(u.createdAt) },
                ]}
              />
              <Pagination page={data.page} limit={data.limit} total={data.total} onPage={list.setPage} />
            </>
          )}
        </QueryState>
      </Card>
    </div>
  );
}
