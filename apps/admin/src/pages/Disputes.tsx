// Litiges : file des dossiers ouverts, dossier complet (colis, offres, conversation, trace GPS) et décision.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { DisputeDto, FileRef, MessageDto, OfferDto, ParcelStatus, UserSummary } from '@ucolis/shared';
import { api } from '../api/client';
import { useAction, useAdminQuery, type Page } from '../api/hooks';
import { ClaimBar, ParcelStatusPill, type ClaimInfo } from '../components/domain';
import { Messages } from '../components/Messages';
import { PrivateFileButton } from '../components/PrivateFile';
import { Button, Card, Filters, KeyValue, PageHeader, Pagination, Pill, QueryState, ReasonDialog, SelectField, Table, type Tone } from '../components/ui';
import { commune, dateTime, label, price, wilaya } from '../format';
import { useListParams } from '../hooks/useListParams';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Ouvert', tone: 'warning' },
  in_review: { label: 'En examen', tone: 'primary' },
  resolved: { label: 'Tranché', tone: 'success' },
};

type DisputeRow = DisputeDto & { reference: string; claim: ClaimInfo | null };

export function Disputes() {
  const list = useListParams(['status'] as const);
  const navigate = useNavigate();
  const query = useAdminQuery<Page<DisputeRow>>(['disputes', list.values, list.page], `/disputes${list.query()}`, { paginated: true });
  return (
    <div>
      <PageHeader title="Litiges" />
      <Card>
        <Filters>
          <SelectField label="Statut" value={list.values.status} onChange={(e) => list.set({ status: e.target.value })} placeholder="Ouverts et en examen" options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} />
        </Filters>
        <QueryState query={query}>
          {(d) => (
            <>
              <Table
                rows={d.items}
                rowKey={(x) => x.id}
                onRowClick={(x) => navigate(`/disputes/${x.id}`)}
                empty="Aucun litige."
                columns={[
                  { header: 'Colis', cell: (x) => <div><div>{x.parcelTitle}</div><div className="font-mono text-xs text-muted">{x.reference}</div></div> },
                  { header: 'Motif', cell: (x) => label('parcel.disputeReasons', x.reason) },
                  { header: 'Ouvert le', cell: (x) => dateTime(x.createdAt) },
                  { header: 'Réponse', cell: (x) => (x.response ? 'Reçue' : `Attendue avant ${dateTime(x.responseDeadline)}`) },
                  { header: 'Statut', cell: (x) => <Pill tone={STATUS[x.status]?.tone}>{STATUS[x.status]?.label ?? x.status}</Pill> },
                  { header: 'Pris par', cell: (x) => (x.claim && new Date(x.claim.until) > new Date() ? x.claim.name : '-') },
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

interface GpsPoint {
  lat: number;
  lng: number;
  at: string;
  speed: number | null;
}
interface DisputeDetailDto {
  dispute: DisputeDto;
  people: Record<string, UserSummary>;
  parcel: {
    id: string;
    reference: string;
    title: string;
    status: ParcelStatus;
    finalPrice: number | null;
    statusHistory: { from: string | null; to: string; byType: string; at: string; reason: string | null }[];
    pickup: { wilayaCode: string; commune: string };
    dropoff: { wilayaCode: string; commune: string };
    deliveryProof: { photo: FileRef | null; note: string | null } | null;
  };
  offers: OfferDto[];
  conversationId: string | null;
  messages: MessageDto[];
  gps: GpsPoint[];
  claim: ClaimInfo | null;
}

export function DisputeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const key = ['dispute', id];
  const query = useAdminQuery<DisputeDetailDto>(key, `/disputes/${id}`);
  const [outcome, setOutcome] = useState<'delivered' | 'cancelled' | null>(null);
  const decide = useAction((note: string) => api.post(`/disputes/${id}/decision`, { outcome, note }), [key, ['disputes'], ['stats']]);

  return (
    <QueryState query={query}>
      {(d) => {
        const x = d.dispute;
        const who = (uid: string) => {
          const u = d.people[uid];
          return u ? <Link className="text-primary-dark underline" to={`/users/${uid}`}>{u.displayName}</Link> : '-';
        };
        const accepted = d.offers.find((o) => o.status === 'accepted');
        return (
          <div className="space-y-6">
            <PageHeader title={`Litige · ${d.parcel.title}`} back="/disputes">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={STATUS[x.status]?.tone}>{STATUS[x.status]?.label}</Pill>
                <Link to={`/parcels/${d.parcel.id}`} className="font-mono text-sm underline">
                  {d.parcel.reference}
                </Link>
                <ParcelStatusPill status={d.parcel.status} />
              </div>
            </PageHeader>
            {x.status !== 'resolved' && <ClaimBar claim={d.claim} path={`/disputes/${id}/claim`} invalidate={key} />}

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Déclaration">
                <KeyValue
                  items={[
                    ['Ouvert par', who(x.openedBy)],
                    ['Contre', who(x.against)],
                    ['Motif', label('parcel.disputeReasons', x.reason)],
                    ['Description', x.description],
                    ['Ouvert le', dateTime(x.createdAt)],
                    ['Photos', x.photos.length ? <span key="p" className="flex flex-wrap gap-2">{x.photos.map((f, i) => <PrivateFileButton key={f.publicId} file={f} label={`Photo ${i + 1}`} />)}</span> : '-'],
                  ]}
                />
              </Card>
              <Card title="Réponse de l’autre partie">
                {x.response ? (
                  <KeyValue
                    items={[
                      ['Reçue le', dateTime(x.response.at)],
                      ['Texte', x.response.text],
                      ['Photos', x.response.photos.length ? <span key="p" className="flex flex-wrap gap-2">{x.response.photos.map((f, i) => <PrivateFileButton key={f.publicId} file={f} label={`Photo ${i + 1}`} />)}</span> : '-'],
                    ]}
                  />
                ) : (
                  <p className="text-sm text-muted">Pas encore de réponse (délai : {dateTime(x.responseDeadline)}).</p>
                )}
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Colis">
                <KeyValue
                  items={[
                    ['Trajet', `${commune(d.parcel.pickup.commune)} (${wilaya(d.parcel.pickup.wilayaCode)}) → ${commune(d.parcel.dropoff.commune)} (${wilaya(d.parcel.dropoff.wilayaCode)})`],
                    ['Prix convenu', price(d.parcel.finalPrice)],
                    ['Offre acceptée', accepted ? `${accepted.carrier.displayName} · ${price(accepted.finalPrice ?? accepted.price)} · ${accepted.vehicle.plate}` : '-'],
                    ['Preuve de livraison', d.parcel.deliveryProof?.photo ? <PrivateFileButton key="pf" file={d.parcel.deliveryProof.photo} label="Voir la photo" /> : (d.parcel.deliveryProof?.note ?? '-')],
                  ]}
                />
                <ol className="mt-4 space-y-1 text-sm">
                  {d.parcel.statusHistory.map((h, i) => (
                    <li key={i}>
                      <span className="text-muted">{dateTime(h.at)}</span> · {label('common.parcelStatus', h.to)} <span className="text-muted">({h.byType})</span>
                      {h.reason && <span className="text-muted"> « {h.reason} »</span>}
                    </li>
                  ))}
                </ol>
              </Card>
              <Card title={`Trace GPS (${d.gps.length} points)`}>
                <GpsTrace points={d.gps} />
              </Card>
            </div>

            <Card title="Conversation" actions={d.conversationId && <Link className="text-sm underline" to={`/conversations/${d.conversationId}?disputeId=${id}`}>Ouvrir</Link>}>
              <Messages messages={d.messages} people={d.people} invalidate={[key]} />
            </Card>

            {x.status === 'resolved' ? (
              <Card title="Décision">
                <KeyValue items={[['Issue', x.outcome === 'delivered' ? 'Livraison confirmée' : 'Livraison annulée'], ['Note', x.decisionNote ?? '-'], ['Tranché le', dateTime(x.resolvedAt)]]} />
              </Card>
            ) : (
              <Card title="Trancher">
                <p className="mb-3 text-sm text-muted">La décision est notifiée aux deux parties avec votre note. En cas d’annulation, le litige compte dans le taux de réussite du transporteur.</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setOutcome('delivered')}>Confirmer la livraison</Button>
                  <Button variant="danger" onClick={() => setOutcome('cancelled')}>
                    Annuler la livraison
                  </Button>
                </div>
              </Card>
            )}
            <ReasonDialog
              open={outcome !== null}
              title={outcome === 'delivered' ? 'Confirmer la livraison' : 'Annuler la livraison'}
              reasonLabel="Note de décision (envoyée aux deux parties, 10 caractères minimum)"
              danger={outcome === 'cancelled'}
              onClose={() => setOutcome(null)}
              onConfirm={(note) => decide.mutateAsync(note).then(() => navigate('/disputes'))}
            />
          </div>
        );
      }}
    </QueryState>
  );
}

/** Tracé simplifié (projection équirectangulaire), suffisant pour juger d'un itinéraire. */
function GpsTrace({ points }: { points: GpsPoint[] }) {
  if (points.length === 0) return <p className="text-sm text-muted">Aucun point enregistré (suivi désactivé ou hors connexion).</p>;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = Math.max(maxLat - minLat, maxLng - minLng, 0.01);
  const xy = (p: GpsPoint) => [((p.lng - minLng) / span) * 280 + 10, (1 - (p.lat - minLat) / span) * 280 + 10] as const;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const osm = (p: GpsPoint) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=13/${p.lat}/${p.lng}`;
  return (
    <div className="space-y-3">
      <svg viewBox="0 0 300 300" className="mx-auto h-64 w-64 rounded bg-background" role="img" aria-label="Tracé GPS">
        <polyline points={points.map((p) => xy(p).join(',')).join(' ')} fill="none" stroke="#FF6B35" strokeWidth="2" />
        <circle cx={xy(first)[0]} cy={xy(first)[1]} r="5" fill="#4ECDC4" />
        <circle cx={xy(last)[0]} cy={xy(last)[1]} r="5" fill="#1C1C2E" />
      </svg>
      <KeyValue
        items={[
          ['Premier point', <a key="f" className="underline" href={osm(first)} target="_blank" rel="noreferrer noopener">{dateTime(first.at)}</a>],
          ['Dernier point', <a key="l" className="underline" href={osm(last)} target="_blank" rel="noreferrer noopener">{dateTime(last.at)}</a>],
        ]}
      />
    </div>
  );
}
