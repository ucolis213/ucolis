import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PARCEL_STATUSES, type FileRef, type OfferDto, type ParcelCommissionDto, type ParcelStatus, type UserSummary } from '@ucolis/shared';
import { api, downloadCsv, qs } from '../api/client';
import { useAction, useAdminQuery, type Page } from '../api/hooks';
import { useSession } from '../auth/session';
import { ParcelStatusPill } from '../components/domain';
import { PrivateFileButton } from '../components/PrivateFile';
import { Button, Card, Filters, Input, KeyValue, PageHeader, Pagination, Pill, QueryState, ReasonDialog, SelectField, Table } from '../components/ui';
import { commune, date, dateTime, label, price, t, wilaya } from '../format';
import { useListParams } from '../hooks/useListParams';
import { WILAYA_OPTIONS } from './Users';

interface ParcelRow {
  id: string;
  reference: string;
  title: string;
  status: ParcelStatus;
  from: string;
  to: string;
  requestedPrice: number;
  finalPrice: number | null;
  offersCount: number;
  hidden: boolean;
  createdAt: string;
}

const STATUS_OPTIONS = PARCEL_STATUSES.map((s) => ({ value: s, label: label('common.parcelStatus', s) }));

export function Parcels() {
  const list = useListParams(['q', 'status', 'wilayaCode'] as const);
  const navigate = useNavigate();
  const query = useAdminQuery<Page<ParcelRow>>(['parcels', list.values, list.page], `/parcels${list.query()}`, { paginated: true });
  const v = list.values;
  return (
    <div>
      <PageHeader
        title="Colis"
        actions={
          <Button variant="outline" onClick={() => void downloadCsv(`/parcels${qs({ ...v, format: 'csv' })}`, 'colis.csv')}>
            Exporter en CSV
          </Button>
        }
      />
      <Card>
        <Filters>
          <Input label="Référence ou mots-clés" defaultValue={v.q} onKeyDown={(e) => e.key === 'Enter' && list.set({ q: e.currentTarget.value })} onBlur={(e) => list.set({ q: e.target.value })} />
          <SelectField label="Statut" value={v.status} onChange={(e) => list.set({ status: e.target.value })} placeholder="Tous" options={STATUS_OPTIONS} />
          <SelectField label="Wilaya (départ ou arrivée)" value={v.wilayaCode} onChange={(e) => list.set({ wilayaCode: e.target.value })} placeholder="Toutes" options={WILAYA_OPTIONS} />
        </Filters>
        <QueryState query={query}>
          {(d) => (
            <>
              <Table
                rows={d.items}
                rowKey={(p) => p.id}
                onRowClick={(p) => navigate(`/parcels/${p.id}`)}
                columns={[
                  { header: 'Référence', cell: (p) => <span className="font-mono text-xs">{p.reference}</span> },
                  { header: 'Titre', cell: (p) => <div>{p.title} {p.hidden && <Pill tone="danger">Masqué</Pill>}</div> },
                  { header: 'Trajet', cell: (p) => `${wilaya(p.from)} → ${wilaya(p.to)}` },
                  { header: 'Prix', cell: (p) => price(p.finalPrice ?? p.requestedPrice) },
                  { header: 'Offres', cell: (p) => p.offersCount },
                  { header: 'Statut', cell: (p) => <ParcelStatusPill status={p.status} /> },
                  { header: 'Créé le', cell: (p) => date(p.createdAt) },
                ]}
              />
              <Pagination page={d.page} limit={d.limit} total={d.total} onPage={list.setPage} />
            </>
          )}
        </QueryState>
      </Card>
    </div>
  );
}

interface Place {
  wilayaCode: string;
  commune: string;
  address?: string;
  location: { lat: number; lng: number } | null;
}
interface ParcelDetailDto {
  parcel: ParcelRow & {
    description: string;
    photos: FileRef[];
    pickup: Place;
    dropoff: Place;
    // null : non précisé (publication rapide).
    weightKg: number | null;
    distanceKm: number;
    desiredDate: string | null;
    desiredTime?: string | null;
    suggestedPrice: number;
    statusHistory: { from: string | null; to: string; byType: string; at: string; reason: string | null }[];
    cancellation: { by: string | null; reason: string | null } | null;
    hiddenInfo: { isHidden: boolean; reason: string | null; at: string | null } | null;
    deliveryProof: { photo: FileRef | null; note: string | null } | null;
    commission: ParcelCommissionDto | null;
  };
  sender: UserSummary | null;
  carrier: UserSummary | null;
  offers: OfferDto[];
  conversationId: string | null;
}

type Dialog = 'force' | 'hide' | 'unhide' | 'delete' | null;

export function ParcelDetail() {
  const { id = '' } = useParams();
  const { can } = useSession();
  const navigate = useNavigate();
  const key = ['parcel', id];
  const query = useAdminQuery<ParcelDetailDto>(key, `/parcels/${id}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [forced, setForced] = useState<ParcelStatus | ''>('');
  const invalidate = [key, ['parcels']];
  const force = useAction((reason: string) => api.post(`/parcels/${id}/force-status`, { status: forced, reason }), invalidate);
  const hide = useAction(({ hidden, reason }: { hidden: boolean; reason: string }) => api.post(`/parcels/${id}/hide`, { hidden, reason }), invalidate);
  const remove = useAction((reason: string) => api.delete(`/parcels/${id}`, { reason }), invalidate);

  return (
    <QueryState query={query}>
      {(d) => {
        const p = d.parcel;
        const place = (x: Place) => `${x.address ? `${x.address}, ` : ''}${commune(x.commune)}, ${wilaya(x.wilayaCode)}`;
        return (
          <div className="space-y-6">
            <PageHeader
              title={p.title}
              back="/parcels"
              actions={
                can('parcels.moderate') && (
                  <>
                    <Button variant="outline" onClick={() => setDialog('force')}>
                      Forcer un statut
                    </Button>
                    <Button variant="outline" onClick={() => setDialog(p.hidden ? 'unhide' : 'hide')}>
                      {p.hidden ? 'Rendre visible' : 'Masquer'}
                    </Button>
                    {['open', 'negotiating', 'expired', 'cancelled'].includes(p.status) && (
                      <Button variant="danger" onClick={() => setDialog('delete')}>
                        Supprimer
                      </Button>
                    )}
                  </>
                )
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm">{p.reference}</span>
                <ParcelStatusPill status={p.status} />
                {p.hidden && <Pill tone="danger">Masqué : {p.hiddenInfo?.reason}</Pill>}
              </div>
            </PageHeader>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Annonce">
                <KeyValue
                  items={[
                    ['Description', p.description || '-'],
                    ['Départ', place(p.pickup)],
                    ['Arrivée', place(p.dropoff)],
                    ['Distance', `${Math.round(p.distanceKm)} km`],
                    ['Poids', p.weightKg === null ? 'Non précisé' : `${p.weightKg} kg`],
                    ['Date souhaitée', p.desiredDate ? `${date(p.desiredDate)}${p.desiredTime ? ` à ${p.desiredTime}` : ''}` : 'Flexible'],
                    ['Prix demandé', price(p.requestedPrice)],
                    ['Prix conseillé', price(p.suggestedPrice)],
                    ['Prix final', price(p.finalPrice)],
                    ['Commission', p.commission ? `${price(p.commission.totalCommission)} (${p.commission.ratePercent} % + ${price(p.commission.fixedFee)}) · ${t(`wallet.breakdown.${p.commission.status}`, { date: dateTime(p.commission.chargedAt) })}` : 'Aucune (course gratuite)'],
                    ['Créé le', dateTime(p.createdAt)],
                  ]}
                />
                {p.photos.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.photos.map((ph) => (
                      <a key={ph.publicId} href={ph.url} target="_blank" rel="noreferrer noopener">
                        <img src={ph.url} alt="" className="h-24 w-24 rounded object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </Card>
              <Card title="Parties">
                <KeyValue
                  items={[
                    ['Expéditeur', d.sender ? <Link key="s" className="text-primary-dark underline" to={`/users/${d.sender.id}`}>{d.sender.displayName}</Link> : '-'],
                    ['Transporteur', d.carrier ? <Link key="c" className="text-primary-dark underline" to={`/users/${d.carrier.id}`}>{d.carrier.displayName}</Link> : '-'],
                    ['Conversation', d.conversationId ? <Link key="v" className="text-primary-dark underline" to={`/conversations/${d.conversationId}`}>Lire (accès journalisé)</Link> : '-'],
                    ['Annulation', p.cancellation?.reason ?? '-'],
                    ['Preuve de livraison', p.deliveryProof?.photo ? <PrivateFileButton key="pf" file={p.deliveryProof.photo} label="Voir la photo" /> : (p.deliveryProof?.note ?? '-')],
                  ]}
                />
              </Card>
            </div>

            <Card title="Historique des statuts">
              <ol className="space-y-2 text-sm">
                {p.statusHistory.map((h, i) => (
                  <li key={i} className="flex flex-wrap gap-2">
                    <span className="text-muted">{dateTime(h.at)}</span>
                    <span>
                      {h.from ? `${label('common.parcelStatus', h.from)} → ` : ''}
                      <strong>{label('common.parcelStatus', h.to)}</strong>
                    </span>
                    <Pill>{h.byType}</Pill>
                    {h.reason && <span className="text-muted">« {h.reason} »</span>}
                  </li>
                ))}
              </ol>
            </Card>

            <Card title={`Offres (${d.offers.length})`}>
              <Table
                rows={d.offers}
                rowKey={(o) => o.id}
                columns={[
                  { header: 'Transporteur', cell: (o) => <Link className="underline" to={`/users/${o.carrier.id}`}>{o.carrier.displayName}</Link> },
                  { header: 'Prix', cell: (o) => price(o.finalPrice ?? o.price) },
                  { header: 'Contre-offres', cell: (o) => o.counterCount },
                  { header: 'Véhicule', cell: (o) => `${label('parcel.vehicleTypes', o.vehicle.type)} · ${o.vehicle.plate}` },
                  { header: 'Statut', cell: (o) => label('offer.statuses', o.status) },
                  { header: 'Date', cell: (o) => dateTime(o.createdAt) },
                ]}
              />
            </Card>

            <ReasonDialog
              open={dialog === 'force'}
              title="Forcer un statut"
              description="Impossible pendant un litige ouvert : passez par le dossier du litige."
              confirmLabel="Forcer"
              extra={<SelectField label="Nouveau statut" value={forced} onChange={(e) => setForced(e.target.value as ParcelStatus)} placeholder="Choisir" options={STATUS_OPTIONS.filter((o) => o.value !== p.status)} required />}
              onClose={() => setDialog(null)}
              onConfirm={force.mutateAsync}
            />
            <ReasonDialog open={dialog === 'hide'} title="Masquer l’annonce" confirmLabel="Masquer" onClose={() => setDialog(null)} onConfirm={(reason) => hide.mutateAsync({ hidden: true, reason })} />
            <ReasonDialog open={dialog === 'unhide'} title="Rendre l’annonce visible" confirmLabel="Rendre visible" onClose={() => setDialog(null)} onConfirm={(reason) => hide.mutateAsync({ hidden: false, reason })} />
            <ReasonDialog
              open={dialog === 'delete'}
              title="Supprimer l’annonce"
              description="L’annonce est annulée et masquée ; les offres en cours sont annulées. L’historique reste pour l’audit."
              confirmLabel="Supprimer"
              danger
              onClose={() => setDialog(null)}
              onConfirm={(reason) => remove.mutateAsync(reason).then(() => navigate('/parcels'))}
            />
          </div>
        );
      }}
    </QueryState>
  );
}
