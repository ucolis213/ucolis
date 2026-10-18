// Files de vérification (identité transporteur et statut pro) : la plus ancienne en premier,
// prise en charge de 30 min, pièces en URL signée de 5 min, refus toujours motivé.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CARRIER_DOCUMENT_KINDS, PRO_CHECKLIST } from '@ucolis/shared';
import { api } from '../api/client';
import { useAction, useAdminQuery } from '../api/hooks';
import { ClaimBar, DocumentViewer, VerificationPill, type ClaimInfo } from '../components/domain';
import { Button, Card, KeyValue, PageHeader, Pill, QueryState, ReasonDialog, Table } from '../components/ui';
import { commune, date, dateTime, hours, label, t, wilaya } from '../format';
import type { AdminUserRow } from './Users';

type SignedFile = { kind: 'image' | 'pdf'; url: string } | null;
const ageHours = (iso: string | null) => (iso ? Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000) : null);

function ClaimCell({ claim }: { claim: ClaimInfo | null }) {
  return claim && new Date(claim.until) > new Date() ? <Pill tone="warning">{claim.name}</Pill> : <span className="text-muted">Libre</span>;
}

// --- Identité --------------------------------------------------------------------------------------

interface IdentityRow {
  userId: string;
  name: string;
  wilayaCode: string;
  submittedAt: string | null;
  vehicles: number;
  claim: ClaimInfo | null;
}

export function IdentityQueue() {
  const navigate = useNavigate();
  const query = useAdminQuery<{ items: IdentityRow[] }>(['verifications', 'identity'], '/verifications/identity');
  return (
    <div>
      <PageHeader title="Vérifications d’identité" />
      <Card>
        <QueryState query={query}>
          {(d) => (
            <Table
              rows={d.items}
              rowKey={(r) => r.userId}
              onRowClick={(r) => navigate(`/verifications/identity/${r.userId}`)}
              empty="Aucun dossier en attente."
              columns={[
                { header: 'Transporteur', cell: (r) => r.name },
                { header: 'Wilaya', cell: (r) => wilaya(r.wilayaCode) },
                { header: 'Véhicules', cell: (r) => r.vehicles },
                { header: 'Soumis', cell: (r) => <span className={(ageHours(r.submittedAt) ?? 0) > 48 ? 'text-danger' : ''}>{dateTime(r.submittedAt)} ({hours(ageHours(r.submittedAt))})</span> },
                { header: 'Pris par', cell: (r) => <ClaimCell claim={r.claim} /> },
              ]}
            />
          )}
        </QueryState>
      </Card>
    </div>
  );
}

interface IdentityDetailDto {
  user: AdminUserRow;
  status: string;
  submittedAt: string | null;
  licenseExpiresAt: string | null;
  insuranceExpiresAt: string | null;
  decisionReason: string | null;
  documents: Record<string, SignedFile>;
  vehicles: { type: string; brand: string; model: string; plate: string; capacityKg: number }[];
  claim: ClaimInfo | null;
}

export function IdentityDetail() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const key = ['verification', 'identity', userId];
  const query = useAdminQuery<IdentityDetailDto>(key, `/verifications/identity/${userId}`);
  const [rejecting, setRejecting] = useState(false);
  const decide = useAction(
    (body: { decision: 'approve' | 'reject'; reason?: string }) => api.post(`/verifications/identity/${userId}/decision`, body),
    [key, ['verifications', 'identity'], ['stats']],
  );
  return (
    <QueryState query={query}>
      {(d) => (
        <div className="space-y-6">
          <PageHeader title={`${d.user.firstName} ${d.user.lastName}`} back="/verifications/identity">
            <VerificationPill kind="identity" status={d.status} />
          </PageHeader>
          <ClaimBar claim={d.claim} path={`/verifications/identity/${userId}/claim`} invalidate={key} />
          <Card title="Dossier">
            <KeyValue
              items={[
                ['Soumis le', dateTime(d.submittedAt)],
                ['Permis valable jusqu’au', date(d.licenseExpiresAt)],
                ['Assurance valable jusqu’au', date(d.insuranceExpiresAt)],
                ['Wilaya', `${commune(d.user.commune)}, ${wilaya(d.user.wilayaCode)}`],
                ['Véhicules', d.vehicles.map((v) => `${label('parcel.vehicleTypes', v.type)} ${v.brand} ${v.model} · ${v.plate} · ${v.capacityKg} kg`).join(' ; ') || '—'],
                ...(d.decisionReason ? ([['Dernier refus', d.decisionReason]] as [string, string][]) : []),
              ]}
            />
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {CARRIER_DOCUMENT_KINDS.map((k) => (
              <DocumentViewer key={k} title={t(`profile.documents.${k}`)} file={d.documents[k] ?? null} />
            ))}
          </div>
          {d.status === 'pending' && (
            <div className="flex flex-wrap gap-2">
              <Button loading={decide.isPending} onClick={() => decide.mutateAsync({ decision: 'approve' }).then(() => navigate('/verifications/identity'))}>
                Valider l’identité
              </Button>
              <Button variant="danger" onClick={() => setRejecting(true)}>
                Refuser
              </Button>
            </div>
          )}
          <ReasonDialog
            open={rejecting}
            title="Refuser la vérification"
            description="Le motif est envoyé au transporteur, qui pourra corriger et renvoyer son dossier."
            reasonLabel="Motif du refus (visible par l’utilisateur)"
            confirmLabel="Refuser"
            danger
            onClose={() => setRejecting(false)}
            onConfirm={(reason) => decide.mutateAsync({ decision: 'reject', reason }).then(() => navigate('/verifications/identity'))}
          />
        </div>
      )}
    </QueryState>
  );
}

// --- Statut professionnel --------------------------------------------------------------------------

interface ProRow {
  userId: string;
  companyName: string;
  legalForm: string;
  wilayaCode: string;
  submittedAt: string;
  change: boolean;
  claim: ClaimInfo | null;
}

export function ProQueue() {
  const navigate = useNavigate();
  const query = useAdminQuery<{ items: ProRow[] }>(['verifications', 'pro'], '/verifications/pro');
  return (
    <div>
      <PageHeader title="Statut professionnel" />
      <Card>
        <QueryState query={query}>
          {(d) => (
            <Table
              rows={d.items}
              rowKey={(r) => r.userId}
              onRowClick={(r) => navigate(`/verifications/pro/${r.userId}`)}
              empty="Aucun dossier en attente."
              columns={[
                { header: 'Entreprise', cell: (r) => <div><div className="font-medium">{r.companyName}</div>{r.change && <Pill tone="primary">Mise à jour</Pill>}</div> },
                { header: 'Forme', cell: (r) => label('profile.legalForms', r.legalForm) },
                { header: 'Wilaya', cell: (r) => wilaya(r.wilayaCode) },
                { header: 'Soumis', cell: (r) => `${dateTime(r.submittedAt)} (${hours(ageHours(r.submittedAt))})` },
                { header: 'Pris par', cell: (r) => <ClaimCell claim={r.claim} /> },
              ]}
            />
          )}
        </QueryState>
      </Card>
    </div>
  );
}

interface ProDetailDto {
  user: AdminUserRow;
  status: string;
  change: boolean;
  current: { companyName: string; rcNumber: string } | null;
  application: {
    companyName: string;
    legalForm: string;
    rcNumber: string;
    nif: string;
    nis: string | null;
    address: string;
    wilayaCode: string;
    commune: string;
    documents: { kind: string; file: SignedFile }[];
    submittedAt: string;
  } | null;
  decisionReason: string | null;
  claim: ClaimInfo | null;
}

const CHECKLIST_LABELS: Record<(typeof PRO_CHECKLIST)[number], string> = {
  readable: 'Pièces lisibles',
  nameMatches: 'La raison sociale correspond au registre de commerce',
  nifFormat: 'NIF à 15 chiffres, identique sur la carte',
  valid: 'Documents en cours de validité',
};
const DOC_LABELS: Record<string, string> = { rc: 'Registre de commerce', nif: 'Carte NIF' };

export function ProDetail() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const key = ['verification', 'pro', userId];
  const query = useAdminQuery<ProDetailDto>(key, `/verifications/pro/${userId}`);
  const [dialog, setDialog] = useState<'reject' | 'revoke' | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const invalidate = [key, ['verifications', 'pro'], ['stats']];
  const decide = useAction((body: { decision: 'approve' | 'reject'; reason?: string }) => api.post(`/verifications/pro/${userId}/decision`, body), invalidate);
  const revoke = useAction((reason: string) => api.post(`/verifications/pro/${userId}/revoke`, { reason }), invalidate);
  const allChecked = PRO_CHECKLIST.every((c) => checks[c]);

  return (
    <QueryState query={query}>
      {(d) => {
        const a = d.application;
        const pending = d.status === 'pending' || d.change;
        return (
          <div className="space-y-6">
            <PageHeader
              title={a?.companyName ?? `${d.user.firstName} ${d.user.lastName}`}
              back="/verifications/pro"
              actions={
                d.status === 'approved' && (
                  <Button variant="danger" onClick={() => setDialog('revoke')}>
                    Révoquer le statut pro
                  </Button>
                )
              }
            >
              <div className="flex gap-2">
                <VerificationPill kind="pro" status={d.status} />
                {d.change && <Pill tone="primary">Nouveau dossier d’un compte déjà validé</Pill>}
              </div>
            </PageHeader>
            {pending && <ClaimBar claim={d.claim} path={`/verifications/pro/${userId}/claim`} invalidate={key} />}
            {a && (
              <Card title="Dossier soumis">
                <KeyValue
                  items={[
                    ['Raison sociale', a.companyName],
                    ['Forme juridique', label('profile.legalForms', a.legalForm)],
                    ['Registre de commerce', a.rcNumber],
                    ['NIF', a.nif],
                    ['NIS', a.nis ?? '—'],
                    ['Adresse', `${a.address}, ${commune(a.commune)}, ${wilaya(a.wilayaCode)}`],
                    ['Titulaire du compte', `${d.user.firstName} ${d.user.lastName}`],
                    ['Soumis le', dateTime(a.submittedAt)],
                    ...(d.current ? ([['Données actuellement validées', `${d.current.companyName} · RC ${d.current.rcNumber}`]] as [string, string][]) : []),
                    ...(d.decisionReason ? ([['Dernier motif', d.decisionReason]] as [string, string][]) : []),
                  ]}
                />
              </Card>
            )}
            {a && (
              <div className="grid gap-4 md:grid-cols-2">
                {a.documents.map((doc) => (
                  <DocumentViewer key={doc.kind} title={DOC_LABELS[doc.kind] ?? doc.kind} file={doc.file} />
                ))}
              </div>
            )}
            {pending && (
              <Card title="Liste de contrôle">
                <div className="space-y-2">
                  {PRO_CHECKLIST.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!checks[c]} onChange={(e) => setChecks((s) => ({ ...s, [c]: e.target.checked }))} />
                      {CHECKLIST_LABELS[c]}
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button disabled={!allChecked} loading={decide.isPending} onClick={() => decide.mutateAsync({ decision: 'approve' }).then(() => navigate('/verifications/pro'))}>
                    Valider le statut pro
                  </Button>
                  <Button variant="danger" onClick={() => setDialog('reject')}>
                    Refuser
                  </Button>
                </div>
              </Card>
            )}
            <ReasonDialog
              open={dialog === 'reject'}
              title="Refuser le dossier"
              reasonLabel="Motif du refus (visible par l’utilisateur)"
              confirmLabel="Refuser"
              danger
              onClose={() => setDialog(null)}
              onConfirm={(reason) => decide.mutateAsync({ decision: 'reject', reason }).then(() => navigate('/verifications/pro'))}
            />
            <ReasonDialog
              open={dialog === 'revoke'}
              title="Révoquer le statut pro"
              description="Le badge pro et les plafonds professionnels sont retirés immédiatement."
              reasonLabel="Motif (visible par l’utilisateur)"
              confirmLabel="Révoquer"
              danger
              onClose={() => setDialog(null)}
              onConfirm={revoke.mutateAsync}
            />
          </div>
        );
      }}
    </QueryState>
  );
}
