// Conversations en lecture seule. Avec view_reported, seules celles citées par un signalement ou un litige ;
// chaque ouverture est journalisée.

import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { MessageDto, UserSummary } from '@ucolis/shared';
import { qs } from '../api/client';
import { useAdminQuery, type Page } from '../api/hooks';
import { useSession } from '../auth/session';
import { Messages } from '../components/Messages';
import { Card, PageHeader, Pagination, QueryState, Table } from '../components/ui';
import { dateTime } from '../format';
import { useListParams } from '../hooks/useListParams';

interface ConversationRow {
  id: string;
  participants: (UserSummary | undefined)[];
  parcelId: string | null;
  lastMessage: { text: string | null; at: string } | null;
}

export function Conversations() {
  const list = useListParams(['userId'] as const);
  const navigate = useNavigate();
  const { can } = useSession();
  const query = useAdminQuery<Page<ConversationRow>>(['conversations', list.values, list.page], `/conversations${list.query()}`, { paginated: true });
  return (
    <div>
      <PageHeader title="Conversations">
        <p className="text-sm text-muted">
          {can('conversations.view_all') ? 'Accès à toutes les conversations : chaque lecture est journalisée.' : 'Seules les conversations visées par un signalement ouvert sont listées.'}
        </p>
      </PageHeader>
      <Card>
        <QueryState query={query}>
          {(d) => (
            <>
              <Table
                rows={d.items}
                rowKey={(c) => c.id}
                onRowClick={(c) => navigate(`/conversations/${c.id}`)}
                empty="Aucune conversation."
                columns={[
                  { header: 'Participants', cell: (c) => c.participants.map((p) => p?.displayName ?? 'Compte supprimé').join(' · ') },
                  { header: 'Dernier message', cell: (c) => <span className="line-clamp-1 max-w-sm">{c.lastMessage?.text ?? '-'}</span> },
                  { header: 'Date', cell: (c) => dateTime(c.lastMessage?.at) },
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

export function ConversationView() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { can } = useSession();
  const via = { reportId: params.get('reportId') ?? undefined, disputeId: params.get('disputeId') ?? undefined };
  const key = ['conversation', id, via];
  const query = useAdminQuery<{ items: MessageDto[]; people: Record<string, UserSummary>; parcelId: string | null }>(key, `/conversations/${id}/messages${qs(via)}`);
  return (
    <div>
      <PageHeader title="Conversation" back={via.disputeId ? `/disputes/${via.disputeId}` : via.reportId ? `/reports/${via.reportId}` : '/conversations'}>
        {query.data?.parcelId && (
          <Link className="text-sm underline" to={`/parcels/${query.data.parcelId}`}>
            Colis lié
          </Link>
        )}
      </PageHeader>
      <Card>
        <QueryState query={query}>
          {(d) => <Messages messages={d.items} people={d.people} canDelete={can('conversations.view_all') || can('conversations.view_reported') || can('reports.handle')} invalidate={[key]} />}
        </QueryState>
      </Card>
    </div>
  );
}
