import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { REPORT_STATUSES, REPORT_TARGET_TYPES, type UserSummary } from '@ucolis/shared';
import { api } from '../api/client';
import { useAction, useAdminQuery, type Page } from '../api/hooks';
import { useSession } from '../auth/session';
import { ClaimBar, type ClaimInfo } from '../components/domain';
import { Button, Card, Filters, KeyValue, PageHeader, Pagination, Pill, QueryState, ReasonDialog, SelectField, Table } from '../components/ui';
import { dateTime, label } from '../format';
import { useListParams } from '../hooks/useListParams';

const STATUS_LABELS: Record<string, string> = { open: 'Ouvert', resolved: 'Traité', dismissed: 'Classé sans suite' };
const TARGET_LABELS: Record<string, string> = { user: 'Utilisateur', parcel: 'Annonce', trip: 'Trajet', review: 'Avis', message: 'Message', conversation: 'Conversation' };

interface ReportRow {
  id: string;
  reporter: UserSummary | null;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  staffNote: string | null;
  createdAt: string;
  claim: ClaimInfo | null;
}

export function Reports() {
  const list = useListParams(['status', 'targetType'] as const);
  const navigate = useNavigate();
  const query = useAdminQuery<Page<ReportRow>>(['reports', list.values, list.page], `/reports${list.query()}`, { paginated: true });
  return (
    <div>
      <PageHeader title="Signalements" />
      <Card>
        <Filters>
          <SelectField label="Statut" value={list.values.status} onChange={(e) => list.set({ status: e.target.value })} placeholder="Ouverts" options={REPORT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }))} />
          <SelectField label="Cible" value={list.values.targetType} onChange={(e) => list.set({ targetType: e.target.value })} placeholder="Toutes" options={REPORT_TARGET_TYPES.map((s) => ({ value: s, label: TARGET_LABELS[s] ?? s }))} />
        </Filters>
        <QueryState query={query}>
          {(d) => (
            <>
              <Table
                rows={d.items}
                rowKey={(r) => r.id}
                onRowClick={(r) => navigate(`/reports/${r.id}`)}
                empty="Aucun signalement."
                columns={[
                  { header: 'Cible', cell: (r) => TARGET_LABELS[r.targetType] ?? r.targetType },
                  { header: 'Motif', cell: (r) => label('common.report.reasons', r.reason) },
                  { header: 'Auteur', cell: (r) => r.reporter?.displayName ?? 'Compte supprimé' },
                  { header: 'Date', cell: (r) => dateTime(r.createdAt) },
                  { header: 'Statut', cell: (r) => STATUS_LABELS[r.status] ?? r.status },
                  { header: 'Pris par', cell: (r) => (r.claim && new Date(r.claim.until) > new Date() ? r.claim.name : '—') },
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

interface ReportDetailDto {
  report: { id: string; targetType: string; targetId: string; reason: string; description: string | null; status: string; staffNote: string | null; createdAt: string; reporter: string | null };
  target: Record<string, unknown> | null;
  sameTargetCount: number;
}

/** Lien vers la cible du signalement dans le back-office. */
function targetLink(type: string, id: string, target: Record<string, unknown> | null, reportId: string): { to: string; text: string } | null {
  switch (type) {
    case 'user':
      return { to: `/users/${id}`, text: String(target?.displayName ?? 'Voir l’utilisateur') };
    case 'parcel':
      return { to: `/parcels/${id}`, text: String(target?.title ?? 'Voir l’annonce') };
    case 'trip':
      return { to: `/trips`, text: 'Voir les trajets' };
    case 'review':
      return { to: `/reviews?userId=${String(target?.target ?? '')}`, text: 'Voir les avis' };
    case 'conversation':
      return { to: `/conversations/${id}?reportId=${reportId}`, text: 'Lire la conversation' };
    case 'message':
      return target?.conversationId ? { to: `/conversations/${String(target.conversationId)}?reportId=${reportId}`, text: 'Lire la conversation' } : null;
    default:
      return null;
  }
}

export function ReportDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useSession();
  const key = ['report', id];
  const query = useAdminQuery<ReportDetailDto>(key, `/reports/${id}`);
  const [action, setAction] = useState<'resolve' | 'dismiss' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const handle = useAction((note: string) => api.post(`/reports/${id}/${action}`, { note }), [key, ['reports'], ['stats']]);
  const deleteMessage = useAction((reason: string) => api.delete(`/messages/${query.data!.report.targetId}`, { reason }), [key]);

  return (
    <QueryState query={query}>
      {(d) => {
        const r = d.report;
        const link = targetLink(r.targetType, r.targetId, d.target, r.id);
        const message = r.targetType === 'message' ? (d.target as { text?: string | null; deleted?: boolean } | null) : null;
        const review = r.targetType === 'review' ? (d.target as { rating?: number; comment?: string | null } | null) : null;
        return (
          <div className="space-y-6">
            <PageHeader title={`Signalement · ${TARGET_LABELS[r.targetType] ?? r.targetType}`} back="/reports">
              <div className="flex gap-2">
                <Pill tone={r.status === 'open' ? 'warning' : 'neutral'}>{STATUS_LABELS[r.status]}</Pill>
                {d.sameTargetCount > 1 && <Pill tone="danger">{d.sameTargetCount} signalements sur cette cible</Pill>}
              </div>
            </PageHeader>
            {r.status === 'open' && <ClaimBar claim={null} path={`/reports/${id}/claim`} invalidate={key} />}
            <Card title="Détails">
              <KeyValue
                items={[
                  ['Motif', label('common.report.reasons', r.reason)],
                  ['Description', r.description || '—'],
                  ['Signalé le', dateTime(r.createdAt)],
                  ['Auteur', r.reporter ? <Link key="a" className="underline" to={`/users/${r.reporter}`}>Voir le profil</Link> : 'Compte supprimé'],
                  ['Cible', link ? <Link key="c" className="text-primary-dark underline" to={link.to}>{link.text}</Link> : 'Supprimée'],
                  ...(message ? ([['Message signalé', message.deleted ? 'Déjà supprimé' : `« ${message.text ?? ''} »`]] as [string, string][]) : []),
                  ...(review ? ([['Avis signalé', `${review.rating ?? '?'}/5 · ${review.comment ?? ''}`]] as [string, string][]) : []),
                  ...(r.staffNote ? ([['Note du staff', r.staffNote]] as [string, string][]) : []),
                ]}
              />
            </Card>
            {r.status === 'open' && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setAction('resolve')}>Marquer comme traité</Button>
                <Button variant="outline" onClick={() => setAction('dismiss')}>
                  Classer sans suite
                </Button>
                {message && !message.deleted && can('reports.handle') && (
                  <Button variant="danger" onClick={() => setDeleting(true)}>
                    Supprimer le message
                  </Button>
                )}
              </div>
            )}
            <ReasonDialog
              open={action !== null}
              title={action === 'resolve' ? 'Marquer comme traité' : 'Classer sans suite'}
              description="L’auteur est prévenu que son signalement a été examiné."
              reasonLabel="Note interne"
              onClose={() => setAction(null)}
              onConfirm={(note) => handle.mutateAsync(note).then(() => navigate('/reports'))}
            />
            <ReasonDialog open={deleting} title="Supprimer le message" danger onClose={() => setDeleting(false)} onConfirm={deleteMessage.mutateAsync} />
          </div>
        );
      }}
    </QueryState>
  );
}
