import { useState } from 'react';
import { Link } from 'react-router';
import type { TripDto } from '@ucolis/shared';
import { api } from '../api/client';
import { useAction, useAdminQuery, type Page } from '../api/hooks';
import { useSession } from '../auth/session';
import { Button, Card, Filters, PageHeader, Pagination, Pill, QueryState, ReasonDialog, SelectField, Table } from '../components/ui';
import { dateTime, label, wilaya } from '../format';
import { useListParams } from '../hooks/useListParams';

type TripRow = TripDto & { hidden: boolean };
const STATUS_LABELS: Record<string, string> = { active: 'Actif', full: 'Complet', completed: 'Terminé', cancelled: 'Annulé' };

export function Trips() {
  const list = useListParams(['status'] as const);
  const { can } = useSession();
  const query = useAdminQuery<Page<TripRow>>(['trips', list.values, list.page], `/trips${list.query()}`, { paginated: true });
  const [target, setTarget] = useState<{ trip: TripRow; action: 'hide' | 'unhide' | 'delete' } | null>(null);
  const hide = useAction(({ id, hidden, reason }: { id: string; hidden: boolean; reason: string }) => api.post(`/trips/${id}/hide`, { hidden, reason }), [['trips']]);
  const remove = useAction(({ id, reason }: { id: string; reason: string }) => api.delete(`/trips/${id}`, { reason }), [['trips']]);

  return (
    <div>
      <PageHeader title="Trajets" />
      <Card>
        <Filters>
          <SelectField label="Statut" value={list.values.status} onChange={(e) => list.set({ status: e.target.value })} placeholder="Tous" options={Object.entries(STATUS_LABELS).map(([value, l]) => ({ value, label: l }))} />
        </Filters>
        <QueryState query={query}>
          {(d) => (
            <>
              <Table
                rows={d.items}
                rowKey={(t) => t.id}
                columns={[
                  { header: 'Transporteur', cell: (t) => <Link className="underline" to={`/users/${t.carrier.id}`}>{t.carrier.displayName}</Link> },
                  { header: 'Itinéraire', cell: (t) => <div>{wilaya(t.from.wilayaCode)} → {wilaya(t.to.wilayaCode)}{t.stops.length > 0 && <div className="text-xs text-muted">via {t.stops.map(wilaya).join(', ')}</div>}</div> },
                  { header: 'Départ', cell: (t) => dateTime(t.departureAt) },
                  { header: 'Véhicule', cell: (t) => label('parcel.vehicleTypes', t.vehicle.type) },
                  { header: 'Statut', cell: (t) => <div className="flex flex-col gap-1"><span>{STATUS_LABELS[t.status] ?? t.status}</span>{t.hidden && <Pill tone="danger">Masqué</Pill>}</div> },
                  {
                    header: 'Actions',
                    cell: (t) =>
                      can('parcels.moderate') && (
                        <div className="flex gap-1">
                          <Button variant="ghost" onClick={() => setTarget({ trip: t, action: t.hidden ? 'unhide' : 'hide' })}>
                            {t.hidden ? 'Afficher' : 'Masquer'}
                          </Button>
                          {t.status !== 'cancelled' && (
                            <Button variant="ghost" className="text-danger" onClick={() => setTarget({ trip: t, action: 'delete' })}>
                              Supprimer
                            </Button>
                          )}
                        </div>
                      ),
                  },
                ]}
              />
              <Pagination page={d.page} limit={d.limit} total={d.total} onPage={list.setPage} />
            </>
          )}
        </QueryState>
      </Card>
      <ReasonDialog
        open={target !== null}
        title={target?.action === 'delete' ? 'Supprimer le trajet' : target?.action === 'hide' ? 'Masquer le trajet' : 'Rendre le trajet visible'}
        danger={target?.action === 'delete'}
        onClose={() => setTarget(null)}
        onConfirm={(reason) => {
          const t = target!;
          return t.action === 'delete' ? remove.mutateAsync({ id: t.trip.id, reason }) : hide.mutateAsync({ id: t.trip.id, hidden: t.action === 'hide', reason });
        }}
      />
    </div>
  );
}
