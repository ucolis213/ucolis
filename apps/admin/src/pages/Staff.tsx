// Gestion du staff (super-administrateur) : invitations, permissions (modèles + cases), désactivation,
// transfert du rôle de super-administrateur.

import { useState, type FormEvent } from 'react';
import { PERMISSIONS, PERMISSION_TEMPLATES, SUPER_ADMIN_ONLY, type Permission, type PermissionTemplate } from '@ucolis/shared';
import { api } from '../api/client';
import { useAction, useAdminQuery } from '../api/hooks';
import { useSession, type StaffDto } from '../auth/session';
import { Button, Card, ErrorBox, Input, Modal, PageHeader, Pill, QueryState, ReasonDialog, SelectField, Table } from '../components/ui';
import { dateTime } from '../format';

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view': 'Tableau de bord',
  'users.view': 'Voir les utilisateurs',
  'users.view_pii': 'Voir email et téléphone en clair',
  'users.suspend': 'Suspendre / réactiver',
  'users.delete': 'Supprimer un compte',
  'verifications.identity': 'Vérifications d’identité',
  'verifications.pro': 'Dossiers professionnels',
  'parcels.view': 'Voir colis et trajets',
  'parcels.moderate': 'Modérer colis et trajets',
  'reviews.moderate': 'Modérer les avis',
  'reports.handle': 'Traiter les signalements',
  'disputes.handle': 'Traiter les litiges',
  'conversations.view_reported': 'Lire les conversations signalées',
  'conversations.view_all': 'Lire toutes les conversations',
  'broadcast.send': 'Envoyer des diffusions',
  'wallet.manage': 'Valider les recharges et ajuster les portefeuilles',
  'content.manage': 'Gérer les contenus',
  'settings.manage': 'Réglages',
  'staff.manage': 'Gérer le staff',
  'audit.view': 'Journal d’audit',
};
const TEMPLATE_LABELS: Record<PermissionTemplate, string> = { verifier: 'Vérificateur', content_moderator: 'Modérateur de contenu', support: 'Support' };
const GRANTABLE = PERMISSIONS.filter((p) => !SUPER_ADMIN_ONLY.includes(p));
const STATUS_LABELS: Record<string, string> = { invited: 'Invité', active: 'Actif', disabled: 'Désactivé' };

export function Staff() {
  const { session } = useSession();
  const query = useAdminQuery<{ items: StaffDto[] }>(['staff'], '/staff');
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const [disabling, setDisabling] = useState<StaffDto | null>(null);
  const [transferring, setTransferring] = useState(false);
  const disable = useAction((reason: string) => api.post(`/staff/${disabling!.id}/disable`, { reason }), [['staff']]);
  const isSuper = session?.staff.role === 'super_admin';

  return (
    <div>
      <PageHeader
        title="Staff"
        actions={
          <>
            <Button onClick={() => setInviting(true)}>Inviter un membre</Button>
            {isSuper && (
              <Button variant="outline" onClick={() => setTransferring(true)}>
                Transférer le rôle de super-admin
              </Button>
            )}
          </>
        }
      />
      <Card>
        <QueryState query={query}>
          {(d) => (
            <>
              <Table
                rows={d.items}
                rowKey={(s) => s.id}
                columns={[
                  { header: 'Nom', cell: (s) => <div><div className="font-medium">{s.firstName} {s.lastName}</div><div className="text-xs text-muted">{s.email}</div></div> },
                  { header: 'Rôle', cell: (s) => (s.role === 'super_admin' ? <Pill tone="primary">Super-admin</Pill> : 'Modérateur') },
                  { header: 'Permissions', cell: (s) => (s.role === 'super_admin' ? 'Toutes' : <span className="text-xs">{s.permissions.map((p) => PERMISSION_LABELS[p]).join(', ') || '-'}</span>) },
                  { header: 'Statut', cell: (s) => <Pill tone={s.status === 'active' ? 'success' : s.status === 'invited' ? 'warning' : 'neutral'}>{STATUS_LABELS[s.status]}</Pill> },
                  { header: 'Dernière connexion', cell: (s) => dateTime(s.lastLoginAt) },
                  {
                    header: 'Actions',
                    cell: (s) =>
                      s.role !== 'super_admin' &&
                      s.id !== session?.staff.id &&
                      s.status !== 'disabled' && (
                        <div className="flex gap-1">
                          <Button variant="ghost" onClick={() => setEditing(s)}>
                            Permissions
                          </Button>
                          <Button variant="ghost" className="text-danger" onClick={() => setDisabling(s)}>
                            Désactiver
                          </Button>
                        </div>
                      ),
                  },
                ]}
              />
              <TransferDialog open={transferring} onClose={() => setTransferring(false)} candidates={d.items.filter((s) => s.role === 'moderator' && s.status === 'active')} />
            </>
          )}
        </QueryState>
      </Card>
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
      {editing && <PermissionsDialog member={editing} onClose={() => setEditing(null)} />}
      <ReasonDialog
        open={disabling !== null}
        title={`Désactiver ${disabling?.firstName ?? ''} ${disabling?.lastName ?? ''}`}
        description="Ses sessions sont révoquées immédiatement."
        danger
        confirmLabel="Désactiver"
        onClose={() => setDisabling(null)}
        onConfirm={disable.mutateAsync}
      />
    </div>
  );
}

function PermissionGrid({ value, onChange }: { value: Permission[]; onChange: (v: Permission[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Permissions</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERMISSION_TEMPLATES) as PermissionTemplate[]).map((t) => (
          <Button key={t} variant="outline" onClick={() => onChange([...PERMISSION_TEMPLATES[t]])}>
            Modèle : {TEMPLATE_LABELS[t]}
          </Button>
        ))}
      </div>
      <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
        {GRANTABLE.map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.includes(p)} onChange={(e) => onChange(e.target.checked ? [...value, p] : value.filter((x) => x !== p))} />
            {PERMISSION_LABELS[p]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const invite = useAction((body: Record<string, unknown>) => api.post('/staff/invite', body), [['staff']]);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await invite.mutateAsync({ email: f.get('email'), firstName: f.get('firstName'), lastName: f.get('lastName'), permissions });
    setPermissions([]);
    onClose();
  }
  return (
    <Modal open={open} title="Inviter un membre du staff" onClose={onClose}>
      <form className="space-y-3" onSubmit={onSubmit}>
        <p className="text-sm text-muted">Un lien valable 72 h est envoyé par email. Le membre définit son mot de passe et sa double authentification.</p>
        <Input label="Email" name="email" type="email" required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" name="firstName" required />
          <Input label="Nom" name="lastName" required />
        </div>
        <PermissionGrid value={permissions} onChange={setPermissions} />
        {invite.error && <ErrorBox error={invite.error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={invite.isPending}>
            Envoyer l’invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PermissionsDialog({ member, onClose }: { member: StaffDto; onClose: () => void }) {
  const [permissions, setPermissions] = useState<Permission[]>(member.permissions);
  const save = useAction((reason: string) => api.patch(`/staff/${member.id}`, { permissions, reason }), [['staff']]);
  return (
    <ReasonDialog
      open
      title={`Permissions de ${member.firstName} ${member.lastName}`}
      extra={<PermissionGrid value={permissions} onChange={setPermissions} />}
      confirmLabel="Enregistrer"
      onClose={onClose}
      onConfirm={save.mutateAsync}
    />
  );
}

function TransferDialog({ open, onClose, candidates }: { open: boolean; onClose: () => void; candidates: StaffDto[] }) {
  const { logout } = useSession();
  const [to, setTo] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const transfer = useAction((reason: string) => api.post('/staff/transfer-super-admin', { toStaffId: to, password, totp, reason }), [['staff']]);
  return (
    <ReasonDialog
      open={open}
      title="Transférer le rôle de super-administrateur"
      description="Vous deviendrez modérateur sans permission. Confirmez avec votre mot de passe et votre code 2FA."
      danger
      confirmLabel="Transférer"
      extra={
        <div className="space-y-3">
          <SelectField label="Nouveau super-administrateur" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Choisir un modérateur actif" options={candidates.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName} (${c.email})` }))} required />
          <Input label="Votre mot de passe" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input label="Code 2FA" inputMode="numeric" pattern="\d{6}" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value)} required />
        </div>
      }
      onClose={onClose}
      onConfirm={(reason) => transfer.mutateAsync(reason).then(() => logout())}
    />
  );
}
