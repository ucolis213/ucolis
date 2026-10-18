// Composants métier partagés : statuts, prise en charge d'un dossier, visionneuse de pièces.

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { parcelStatusColors, type ParcelStatus } from '@ucolis/shared';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/session';
import { dateTime, label, USER_STATUS_LABELS } from '../format';
import { Button, Pill, type Tone } from './ui';

export function ParcelStatusPill({ status }: { status: ParcelStatus }) {
  const c = parcelStatusColors[status];
  return <Pill style={{ color: c.fg, background: c.bg }}>{label('common.parcelStatus', status)}</Pill>;
}

const USER_TONES: Record<string, Tone> = { active: 'success', suspended: 'danger', pending_deletion: 'warning', deleted: 'neutral' };
export function UserStatusPill({ status }: { status: string }) {
  return <Pill tone={USER_TONES[status] ?? 'neutral'}>{USER_STATUS_LABELS[status] ?? status}</Pill>;
}

const VERIFICATION_TONES: Record<string, Tone> = { approved: 'success', pending: 'warning', rejected: 'danger', expired: 'danger', revoked: 'danger' };
export function VerificationPill({ status, kind }: { status: string; kind: 'identity' | 'pro' }) {
  const prefix = kind === 'identity' ? 'profile.verificationStatuses' : 'profile.proStatuses';
  return <Pill tone={VERIFICATION_TONES[status] ?? 'neutral'}>{label(prefix, status)}</Pill>;
}

export interface ClaimInfo {
  by: string;
  name: string;
  until: string;
}

/** « Prendre le dossier » : réservation de 30 min, visible des autres membres du staff. */
export function ClaimBar({ claim, path, invalidate }: { claim: ClaimInfo | null; path: string; invalidate: QueryKey }) {
  const { session } = useSession();
  const qc = useQueryClient();
  const mine = claim?.by === session?.staff.id;
  const active = claim && new Date(claim.until) > new Date();
  const mutation = useMutation({
    mutationFn: () => api.post(path),
    onSuccess: () => qc.invalidateQueries({ queryKey: invalidate }),
  });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-3 text-sm">
      {active ? (
        <span>
          {mine ? 'Vous traitez ce dossier' : `Pris en charge par ${claim.name}`} jusqu’à {dateTime(claim.until)}.
        </span>
      ) : (
        <span className="text-muted">Dossier libre.</span>
      )}
      {(!active || mine) && (
        <Button variant="outline" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          {mine ? 'Prolonger 30 min' : 'Prendre le dossier'}
        </Button>
      )}
      {mutation.error && <span className="text-danger">{errorText(mutation.error)}</span>}
    </div>
  );
}

/** Pièce servie par URL signée de 5 min : image affichée, PDF ouvert dans un cadre. */
export function DocumentViewer({ title, file }: { title: string; file: { kind: 'image' | 'pdf'; url: string } | null }) {
  const [zoom, setZoom] = useState(false);
  if (!file) {
    return (
      <figure className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
        <figcaption className="font-medium text-navy">{title}</figcaption>
        Pièce manquante.
      </figure>
    );
  }
  return (
    <figure className="space-y-2 rounded-lg border border-border p-3">
      <figcaption className="flex items-center justify-between text-sm font-medium">
        {title}
        <a href={file.url} target="_blank" rel="noreferrer noopener" className="text-xs text-primary-dark underline">
          Ouvrir
        </a>
      </figcaption>
      {file.kind === 'pdf' ? (
        <iframe title={title} src={file.url} className="h-72 w-full rounded bg-background" />
      ) : (
        <button onClick={() => setZoom((z) => !z)} className="block w-full" aria-label={`Agrandir ${title}`}>
          <img src={file.url} alt={title} className={`w-full rounded bg-background object-contain ${zoom ? 'max-h-none' : 'max-h-72'}`} />
        </button>
      )}
    </figure>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} sur 5`} className="whitespace-nowrap text-warning">
      {'★'.repeat(Math.round(value))}
      <span className="text-border">{'★'.repeat(5 - Math.round(value))}</span>
    </span>
  );
}
