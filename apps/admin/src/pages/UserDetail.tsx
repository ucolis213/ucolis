import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { ParcelStatus } from '@ucolis/shared';
import { api } from '../api/client';
import { useAction, useAdminQuery } from '../api/hooks';
import { useSession } from '../auth/session';
import { ParcelStatusPill, Stars, UserStatusPill, VerificationPill } from '../components/domain';
import { Button, Card, Input, KeyValue, PageHeader, Pill, QueryState, ReasonDialog, Table, Tabs } from '../components/ui';
import { commune, date, dateTime, INTENT_LABELS, label, price, wilaya } from '../format';
import type { AdminUserRow } from './Users';

interface UserDetailDto {
  user: AdminUserRow & { bio: string; vehicles: { type: string; brand: string; model: string; plate: string }[]; badges: { pro: boolean; identity: boolean } };
  parcels: { id: string; reference: string; title: string; status: ParcelStatus; role: 'sender' | 'carrier'; price: number; createdAt: string }[];
  offers: { id: string; parcelId: string; price: number; status: string; createdAt: string }[];
  devices: { id: string; deviceName: string | null; platform: string | null; lastActiveAt: string }[];
  reviews: { id: string; rating: number; comment: string | null; mine: boolean; hidden: boolean; publishedAt: string | null }[];
  reports: { id: string; reason: string; status: string; against: boolean; createdAt: string }[];
  disputes: { id: string; parcelId: string; reason: string; status: string; outcome: string | null; createdAt: string }[];
}

type Tab = 'parcels' | 'offers' | 'reviews' | 'reports' | 'disputes' | 'devices';
type Dialog = 'suspend' | 'reactivate' | 'delete' | null;

export function UserDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useSession();
  const query = useAdminQuery<UserDetailDto>(['user', id], `/users/${id}`);
  const [tab, setTab] = useState<Tab>('parcels');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [until, setUntil] = useState('');
  const invalidate = [['user', id], ['users']];
  const suspend = useAction((reason: string) => api.post(`/users/${id}/suspend`, { reason, until: until ? new Date(until).toISOString() : null }), invalidate);
  const reactivate = useAction((reason: string) => api.post(`/users/${id}/reactivate`, { reason }), invalidate);
  const remove = useAction((reason: string) => api.delete(`/users/${id}`, { reason }), invalidate);

  return (
    <QueryState query={query}>
      {(d) => {
        const u = d.user;
        return (
          <div className="space-y-6">
            <PageHeader
              title={`${u.firstName} ${u.lastName}`}
              back="/users"
              actions={
                <>
                  {can('users.suspend') && u.status === 'active' && (
                    <Button variant="outline" onClick={() => setDialog('suspend')}>
                      Suspendre
                    </Button>
                  )}
                  {can('users.suspend') && u.status === 'suspended' && <Button onClick={() => setDialog('reactivate')}>Réactiver</Button>}
                  {can('users.delete') && u.status !== 'deleted' && (
                    <Button variant="danger" onClick={() => setDialog('delete')}>
                      Supprimer le compte
                    </Button>
                  )}
                </>
              }
            >
              <div className="flex flex-wrap gap-2">
                <UserStatusPill status={u.status} />
                <VerificationPill kind="identity" status={u.carrierVerification} />
                {u.proStatus !== 'none' && <VerificationPill kind="pro" status={u.proStatus} />}
                {!u.emailVerified && <Pill tone="warning">Email non vérifié</Pill>}
              </div>
            </PageHeader>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Profil">
                <KeyValue
                  items={[
                    ['Email', u.email],
                    ['Téléphone', u.phone],
                    ['Localisation', `${commune(u.commune)}, ${wilaya(u.wilayaCode)}`],
                    ['Profil', INTENT_LABELS[u.intent] ?? u.intent],
                    ['Entreprise', u.companyName ?? '—'],
                    ['Bio', u.bio || '—'],
                    ['Inscrit le', date(u.createdAt)],
                    ['Dernière activité', dateTime(u.lastSeenAt)],
                    ...(u.suspension ? ([['Suspension', `${u.suspension.reason ?? ''} (jusqu’au ${u.suspension.until ? date(u.suspension.until) : 'levée manuelle'})`]] as [string, string][]) : []),
                  ]}
                />
              </Card>
              <Card title="Confiance">
                <KeyValue
                  items={[
                    ['Note', <span key="r"><Stars value={u.rating.average} /> {u.rating.average.toFixed(1)} ({u.rating.count} avis)</span>],
                    ['Colis envoyés', u.stats.parcelsSent],
                    ['Colis transportés', u.stats.parcelsCarried],
                    ['Désistements', u.stats.withdrawals],
                    ['Litiges perdus', u.stats.disputesLost],
                    ['Taux de réussite', u.stats.successRate === null ? '—' : `${u.stats.successRate} %`],
                    ['Véhicules', u.vehicles.length ? u.vehicles.map((v) => `${v.brand} ${v.model} (${v.plate})`).join(', ') : '—'],
                  ]}
                />
              </Card>
            </div>

            <Card>
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { key: 'parcels', label: 'Colis', count: d.parcels.length },
                  { key: 'offers', label: 'Offres', count: d.offers.length },
                  { key: 'reviews', label: 'Avis', count: d.reviews.length },
                  { key: 'reports', label: 'Signalements', count: d.reports.length },
                  { key: 'disputes', label: 'Litiges', count: d.disputes.length },
                  { key: 'devices', label: 'Appareils', count: d.devices.length },
                ]}
              />
              {tab === 'parcels' && (
                <Table
                  rows={d.parcels}
                  rowKey={(p) => p.id}
                  onRowClick={(p) => navigate(`/parcels/${p.id}`)}
                  columns={[
                    { header: 'Référence', cell: (p) => <span className="font-mono text-xs">{p.reference}</span> },
                    { header: 'Titre', cell: (p) => p.title },
                    { header: 'Rôle', cell: (p) => (p.role === 'sender' ? 'Expéditeur' : 'Transporteur') },
                    { header: 'Prix', cell: (p) => price(p.price) },
                    { header: 'Statut', cell: (p) => <ParcelStatusPill status={p.status} /> },
                    { header: 'Créé le', cell: (p) => date(p.createdAt) },
                  ]}
                />
              )}
              {tab === 'offers' && (
                <Table
                  rows={d.offers}
                  rowKey={(o) => o.id}
                  onRowClick={(o) => navigate(`/parcels/${o.parcelId}`)}
                  columns={[
                    { header: 'Prix', cell: (o) => price(o.price) },
                    { header: 'Statut', cell: (o) => label('offer.statuses', o.status) },
                    { header: 'Date', cell: (o) => date(o.createdAt) },
                  ]}
                />
              )}
              {tab === 'reviews' && (
                <Table
                  rows={d.reviews}
                  rowKey={(r) => r.id}
                  columns={[
                    { header: 'Sens', cell: (r) => (r.mine ? 'Donné' : 'Reçu') },
                    { header: 'Note', cell: (r) => <Stars value={r.rating} /> },
                    { header: 'Commentaire', cell: (r) => r.comment ?? '—' },
                    { header: 'État', cell: (r) => (r.hidden ? <Pill tone="danger">Masqué</Pill> : r.publishedAt ? 'Publié' : 'En attente') },
                  ]}
                />
              )}
              {tab === 'reports' && (
                <Table
                  rows={d.reports}
                  rowKey={(r) => r.id}
                  onRowClick={can('reports.handle') ? (r) => navigate(`/reports/${r.id}`) : undefined}
                  columns={[
                    { header: 'Sens', cell: (r) => (r.against ? 'Visé' : 'Auteur') },
                    { header: 'Motif', cell: (r) => label('common.report.reasons', r.reason) },
                    { header: 'Statut', cell: (r) => r.status },
                    { header: 'Date', cell: (r) => date(r.createdAt) },
                  ]}
                />
              )}
              {tab === 'disputes' && (
                <Table
                  rows={d.disputes}
                  rowKey={(x) => x.id}
                  onRowClick={can('disputes.handle') ? (x) => navigate(`/disputes/${x.id}`) : undefined}
                  columns={[
                    { header: 'Motif', cell: (x) => label('parcel.disputeReasons', x.reason) },
                    { header: 'Statut', cell: (x) => x.status },
                    { header: 'Issue', cell: (x) => x.outcome ?? '—' },
                    { header: 'Date', cell: (x) => date(x.createdAt) },
                  ]}
                />
              )}
              {tab === 'devices' && (
                <Table
                  rows={d.devices}
                  rowKey={(x) => x.id}
                  columns={[
                    { header: 'Appareil', cell: (x) => x.deviceName ?? '—' },
                    { header: 'Plateforme', cell: (x) => x.platform ?? '—' },
                    { header: 'Dernière activité', cell: (x) => dateTime(x.lastActiveAt) },
                  ]}
                />
              )}
              {tab === 'reviews' && can('reviews.moderate') && (
                <Link to={`/reviews?userId=${u.id}`} className="mt-3 inline-block text-sm text-primary-dark underline">
                  Modérer ses avis
                </Link>
              )}
            </Card>

            <ReasonDialog
              open={dialog === 'suspend'}
              title="Suspendre le compte"
              description="Les sessions sont révoquées immédiatement. L’utilisateur voit le motif à sa prochaine connexion."
              confirmLabel="Suspendre"
              danger
              extra={<Input label="Jusqu’au (vide = levée manuelle)" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />}
              onClose={() => setDialog(null)}
              onConfirm={suspend.mutateAsync}
            />
            <ReasonDialog open={dialog === 'reactivate'} title="Réactiver le compte" confirmLabel="Réactiver" onClose={() => setDialog(null)} onConfirm={reactivate.mutateAsync} />
            <ReasonDialog
              open={dialog === 'delete'}
              title="Supprimer le compte"
              description="Suppression immédiate : données personnelles effacées, colis actifs annulés, avis conservés de façon anonyme. Action irréversible."
              confirmLabel="Supprimer définitivement"
              danger
              onClose={() => setDialog(null)}
              onConfirm={remove.mutateAsync}
            />
          </div>
        );
      }}
    </QueryState>
  );
}
