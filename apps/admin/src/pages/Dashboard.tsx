import { Link } from 'react-router';
import { PARCEL_STATUSES, type ParcelStatus } from '@ucolis/shared';
import { useAdminQuery } from '../api/hooks';
import { useSession } from '../auth/session';
import { ParcelStatusPill } from '../components/domain';
import { StorageUsageCard } from '../components/StorageUsage';
import { Card, PageHeader, QueryState } from '../components/ui';
import { hours, price } from '../format';

interface Stats {
  users: { total: number; active30d: number; newThisMonth: number; suspended: number };
  parcels: Record<ParcelStatus, number>;
  deliveredAmount: number;
  deliveryRate: number | null;
  medianMinutesToFirstOffer: number | null;
  queues: Record<'identity' | 'pro' | 'reports' | 'disputes' | 'topUps', { count: number; oldestHours: number | null }>;
  wallet: { commissions: number; pendingTopUps: number; blockedWallets: number };
}

const QUEUES = [
  { key: 'identity', label: 'Vérifications identité', to: '/verifications/identity', permission: 'verifications.identity' },
  { key: 'pro', label: 'Dossiers pro', to: '/verifications/pro', permission: 'verifications.pro' },
  { key: 'reports', label: 'Signalements', to: '/reports', permission: 'reports.handle' },
  { key: 'disputes', label: 'Litiges', to: '/disputes', permission: 'disputes.handle' },
  { key: 'topUps', label: 'Recharges à vérifier', to: '/wallets', permission: 'wallet.manage' },
] as const;

export function Dashboard() {
  const query = useAdminQuery<Stats>(['stats'], '/stats');
  const { can } = useSession();
  return (
    <div>
      <PageHeader title="Tableau de bord" />
      <QueryState query={query}>
        {(s) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Tile label="Utilisateurs" value={s.users.total} />
              <Tile label="Actifs sur 30 jours" value={s.users.active30d} />
              <Tile label="Nouveaux ce mois" value={s.users.newThisMonth} />
              <Tile label="Suspendus" value={s.users.suspended} />
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Tile label="Montant livré (déclaratif)" value={price(s.deliveredAmount)} />
              <Tile label="Taux de livraison" value={s.deliveryRate === null ? '-' : `${s.deliveryRate} %`} />
              <Tile
                label="Délai médian avant 1re offre"
                value={s.medianMinutesToFirstOffer === null ? '-' : s.medianMinutesToFirstOffer < 120 ? `${Math.round(s.medianMinutesToFirstOffer)} min` : `${Math.round(s.medianMinutesToFirstOffer / 60)} h`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Tile label="Commissions encaissées" value={price(s.wallet.commissions)} />
              <Tile label="Portefeuilles sous le seuil" value={s.wallet.blockedWallets} />
              <Tile label="Recharges en attente" value={s.wallet.pendingTopUps} />
            </div>

            <Card title="Files d’attente">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {QUEUES.filter((q) => can(q.permission)).map((q) => {
                  const v = s.queues[q.key];
                  return (
                    <Link key={q.key} to={q.to} className="rounded-lg border border-border p-4 hover:border-primary">
                      <div className="text-sm text-muted">{q.label}</div>
                      <div className="mt-1 text-2xl font-bold">{v.count}</div>
                      <div className={`text-xs ${v.oldestHours !== null && v.oldestHours > 48 ? 'text-danger' : 'text-muted'}`}>
                        Plus ancien : {hours(v.oldestHours)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>

            <StorageUsageCard />

            <Card title="Colis par statut">
              <div className="flex flex-wrap gap-2">
                {PARCEL_STATUSES.map((st) => (
                  <Link key={st} to={`/parcels?status=${st}`} className="flex items-center gap-1">
                    <ParcelStatusPill status={st} />
                    <span className="text-sm font-semibold">{s.parcels[st] ?? 0}</span>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        )}
      </QueryState>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-sm">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 text-2xl font-bold text-navy">{value}</div>
    </div>
  );
}
