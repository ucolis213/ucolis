// Fil de messages en lecture seule (litiges, signalements, conversations), avec suppression motivée.

import { useState } from 'react';
import type { MessageDto, UserSummary } from '@ucolis/shared';
import { api } from '../api/client';
import { useAction } from '../api/hooks';
import { dateTime, t } from '../format';
import { PrivateFileButton } from './PrivateFile';
import { Button, Empty, ReasonDialog } from './ui';

export function Messages({ messages, people, canDelete, invalidate }: { messages: MessageDto[]; people: Record<string, UserSummary | undefined>; canDelete?: boolean; invalidate: unknown[][] }) {
  const [target, setTarget] = useState<MessageDto | null>(null);
  const remove = useAction((reason: string) => api.delete(`/messages/${target!.id}`, { reason }), invalidate);
  if (!messages.length) return <Empty>Aucun message.</Empty>;
  return (
    <>
      <ol className="max-h-[32rem] space-y-2 overflow-y-auto">
        {messages.map((m) => (
          <li key={m.id} className={`rounded-lg p-3 text-sm ${m.type === 'system' ? 'bg-background text-center text-muted' : 'border border-border'}`}>
            {m.type !== 'system' && (
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span className="font-semibold text-navy">{(m.authorId && people[m.authorId]?.displayName) ?? 'Utilisateur'}</span>
                <span>{dateTime(m.createdAt)}</span>
              </div>
            )}
            {m.type === 'system' ? (
              <span>
                {t(`chat.system.${m.systemKey}`, (m.systemParams ?? {}) as Record<string, string | number>)} · {dateTime(m.createdAt)}
              </span>
            ) : m.deleted ? (
              <em className="text-muted">Message supprimé{m.text ? ` : « ${m.text} »` : ''}</em>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                {m.image && <PrivateFileButton file={m.image} label="Image" />}
                {canDelete && (
                  <Button variant="ghost" className="text-danger" onClick={() => setTarget(m)}>
                    Supprimer
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <ReasonDialog open={target !== null} title="Supprimer le message" danger confirmLabel="Supprimer" onClose={() => setTarget(null)} onConfirm={remove.mutateAsync} />
    </>
  );
}
