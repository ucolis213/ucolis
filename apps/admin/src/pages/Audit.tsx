// Journal d'audit (lecture seule, append-only côté API) : filtres et export CSV.

import { Fragment, useState } from 'react';
import { downloadCsv, qs } from '../api/client';
import { useAdminQuery, type Page } from '../api/hooks';
import { Button, Card, Filters, Input, PageHeader, Pagination, QueryState } from '../components/ui';
import { dateTime } from '../format';
import { useListParams } from '../hooks/useListParams';

interface AuditRow {
  id: string;
  at: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
}

const KEYS = ['action', 'targetType', 'targetId', 'from', 'to'] as const;

export function Audit() {
  const list = useListParams(KEYS);
  const v = list.values;
  const filters = { ...v, from: v.from ? new Date(v.from).toISOString() : '', to: v.to ? new Date(`${v.to}T23:59:59`).toISOString() : '' };
  const query = useAdminQuery<Page<AuditRow>>(['audit', v, list.page], `/audit${qs({ ...filters, page: list.page, limit: 50 })}`, { paginated: true });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <PageHeader
        title="Journal d’audit"
        actions={
          <Button variant="outline" onClick={() => void downloadCsv(`/audit/export${qs(filters)}`, 'audit.csv')}>
            Exporter en CSV
          </Button>
        }
      />
      <Card>
        <Filters>
          <Input label="Action" placeholder="user.suspend" defaultValue={v.action} onBlur={(e) => list.set({ action: e.target.value })} />
          <Input label="Type de cible" placeholder="user, parcel…" defaultValue={v.targetType} onBlur={(e) => list.set({ targetType: e.target.value })} />
          <Input label="Identifiant de cible" defaultValue={v.targetId} onBlur={(e) => list.set({ targetId: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Du" type="date" value={v.from} onChange={(e) => list.set({ from: e.target.value })} />
            <Input label="Au" type="date" value={v.to} onChange={(e) => list.set({ to: e.target.value })} />
          </div>
        </Filters>
        <QueryState query={query}>
          {(d) => (
            <>
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted">
                      {['Date', 'Membre', 'Action', 'Cible', 'Motif', 'IP'].map((h) => (
                        <th key={h} className="px-5 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((e) => (
                      <Fragment key={e.id}>
                        <tr className="cursor-pointer border-b border-border hover:bg-background" onClick={() => setOpen(open === e.id ? null : e.id)}>
                          <td className="px-5 py-2 whitespace-nowrap">{dateTime(e.at)}</td>
                          <td className="px-5 py-2">{e.actor}</td>
                          <td className="px-5 py-2 font-mono text-xs">{e.action}</td>
                          <td className="px-5 py-2 text-xs">
                            {e.targetType}
                            {e.targetId && <span className="block font-mono text-muted">{e.targetId}</span>}
                          </td>
                          <td className="px-5 py-2">{e.reason ?? '—'}</td>
                          <td className="px-5 py-2 text-xs text-muted">{e.ip ?? '—'}</td>
                        </tr>
                        {open === e.id && (
                          <tr className="border-b border-border bg-background">
                            <td colSpan={6} className="px-5 py-3">
                              <div className="grid gap-3 md:grid-cols-2">
                                <Json title="Avant" value={e.before} />
                                <Json title="Après" value={e.after} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {d.items.length === 0 && <p className="py-8 text-center text-sm text-muted">Aucune entrée.</p>}
              <Pagination page={d.page} limit={d.limit} total={d.total} onPage={list.setPage} />
            </>
          )}
        </QueryState>
      </Card>
    </div>
  );
}

function Json({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted">{title}</div>
      <pre className="max-h-64 overflow-auto rounded bg-surface p-2 text-xs">{value === null || value === undefined ? '—' : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
