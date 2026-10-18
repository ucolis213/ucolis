import { useState } from 'react';
import { Link } from 'react-router';
import type { ReviewDto } from '@ucolis/shared';
import { api } from '../api/client';
import { useAction, useAdminQuery, type Page } from '../api/hooks';
import { Stars } from '../components/domain';
import { Button, Card, Filters, PageHeader, Pagination, Pill, QueryState, ReasonDialog, SelectField, Table } from '../components/ui';
import { date } from '../format';
import { useListParams } from '../hooks/useListParams';

type ReviewRow = ReviewDto & { hidden: boolean };

export function Reviews() {
  const list = useListParams(['hidden', 'maxRating', 'userId'] as const);
  const query = useAdminQuery<Page<ReviewRow>>(['reviews', list.values, list.page], `/reviews${list.query()}`, { paginated: true });
  const [target, setTarget] = useState<{ review: ReviewRow; action: 'hide' | 'unhide' | 'delete' } | null>(null);
  const hide = useAction(({ id, hidden, reason }: { id: string; hidden: boolean; reason: string }) => api.post(`/reviews/${id}/hide`, { hidden, reason }), [['reviews']]);
  const remove = useAction(({ id, reason }: { id: string; reason: string }) => api.delete(`/reviews/${id}`, { reason }), [['reviews']]);

  return (
    <div>
      <PageHeader title="Avis">{list.values.userId && <p className="text-sm text-muted">Filtrés sur un utilisateur. <button className="underline" onClick={() => list.set({ userId: '' })}>Tout afficher</button></p>}</PageHeader>
      <Card>
        <Filters>
          <SelectField
            label="Visibilité"
            value={list.values.hidden}
            onChange={(e) => list.set({ hidden: e.target.value })}
            placeholder="Tous"
            options={[
              { value: 'false', label: 'Visibles' },
              { value: 'true', label: 'Masqués' },
            ]}
          />
          <SelectField label="Note maximale" value={list.values.maxRating} onChange={(e) => list.set({ maxRating: e.target.value })} placeholder="Toutes" options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} étoile${n > 1 ? 's' : ''} ou moins` }))} />
        </Filters>
        <QueryState query={query}>
          {(d) => (
            <>
              <Table
                rows={d.items}
                rowKey={(r) => r.id}
                columns={[
                  { header: 'Note', cell: (r) => <Stars value={r.rating} /> },
                  { header: 'Commentaire', cell: (r) => <div className="max-w-md">{r.comment ?? '—'}{r.reply && <div className="mt-1 text-xs text-muted">↳ {r.reply.text}</div>}</div> },
                  { header: 'Auteur', cell: (r) => <Link className="underline" to={`/users/${r.author.id}`}>{r.author.displayName}</Link> },
                  { header: 'Date', cell: (r) => date(r.publishedAt ?? r.createdAt) },
                  { header: 'État', cell: (r) => (r.hidden ? <Pill tone="danger">Masqué</Pill> : r.publishedAt ? <Pill tone="success">Publié</Pill> : <Pill>En attente</Pill>) },
                  {
                    header: 'Actions',
                    cell: (r) => (
                      <div className="flex gap-1">
                        <Button variant="ghost" onClick={() => setTarget({ review: r, action: r.hidden ? 'unhide' : 'hide' })}>
                          {r.hidden ? 'Afficher' : 'Masquer'}
                        </Button>
                        <Button variant="ghost" className="text-danger" onClick={() => setTarget({ review: r, action: 'delete' })}>
                          Supprimer
                        </Button>
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
        title={target?.action === 'delete' ? 'Supprimer l’avis' : target?.action === 'hide' ? 'Masquer l’avis' : 'Rendre l’avis visible'}
        description="La note moyenne de l’utilisateur est recalculée."
        danger={target?.action === 'delete'}
        onClose={() => setTarget(null)}
        onConfirm={(reason) => {
          const t = target!;
          return t.action === 'delete' ? remove.mutateAsync({ id: t.review.id, reason }) : hide.mutateAsync({ id: t.review.id, hidden: t.action === 'hide', reason });
        }}
      />
    </div>
  );
}
