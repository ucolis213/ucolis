// Diffusion (notification à un segment) : titre et texte bilingues, aperçu du nombre de destinataires,
// envoi immédiat ou programmé.

import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { useAction, useAdminQuery } from '../api/hooks';
import { Button, Card, ErrorBox, Input, PageHeader, QueryState, SelectField, Table, TextArea } from '../components/ui';
import { dateTime, wilaya } from '../format';
import { WILAYA_OPTIONS } from './Users';

const SEGMENTS = [
  { value: 'all', label: 'Tous les utilisateurs actifs' },
  { value: 'carriers', label: 'Transporteurs' },
  { value: 'senders', label: 'Expéditeurs' },
  { value: 'pros', label: 'Professionnels' },
  { value: 'wilaya', label: 'Une wilaya' },
];

interface Broadcast {
  _id: string;
  title: { fr: string; ar: string };
  body: { fr: string; ar: string };
  segment: { kind: string; wilayaCode: string | null };
  link: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  recipients: number;
  createdAt: string;
}

const EMPTY = { titleFr: '', titleAr: '', bodyFr: '', bodyAr: '', kind: 'all', wilayaCode: '', link: '', scheduledAt: '', reason: '' };

export function Broadcasts() {
  const history = useAdminQuery<{ items: Broadcast[] }>(['broadcasts'], '/broadcasts');
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const segment = { kind: form.kind, wilayaCode: form.kind === 'wilaya' ? form.wilayaCode || null : null };
  const preview = useMutation({ mutationFn: () => api.post<{ recipients: number }>('/broadcasts/preview', { segment }) });
  const send = useAction(
    () =>
      api.post<Broadcast>('/broadcasts', {
        title: { fr: form.titleFr, ar: form.titleAr },
        body: { fr: form.bodyFr, ar: form.bodyAr },
        segment,
        link: form.link || null,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        reason: form.reason,
      }),
    [['broadcasts']],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const count = preview.data?.recipients ?? (await preview.mutateAsync()).recipients;
    if (!window.confirm(`Envoyer cette notification à ${count} utilisateur(s) ?`)) return;
    const b = await send.mutateAsync(undefined);
    setSent(b.sentAt ? `Envoyée à ${b.recipients} utilisateur(s).` : `Programmée pour le ${dateTime(b.scheduledAt)}.`);
    setForm(EMPTY);
    preview.reset();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Diffusion" />
      <Card title="Nouvelle notification">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <Input label="Titre (français)" value={form.titleFr} onChange={set('titleFr')} maxLength={80} required />
          <Input label="Titre (arabe)" dir="rtl" lang="ar" value={form.titleAr} onChange={set('titleAr')} maxLength={80} required />
          <TextArea label="Texte (français)" value={form.bodyFr} onChange={set('bodyFr')} maxLength={500} required />
          <TextArea label="Texte (arabe)" dir="rtl" lang="ar" value={form.bodyAr} onChange={set('bodyAr')} maxLength={500} required />
          <SelectField
            label="Destinataires"
            value={form.kind}
            onChange={(e) => {
              set('kind')(e);
              preview.reset();
            }}
            options={SEGMENTS}
          />
          {form.kind === 'wilaya' ? (
            <SelectField
              label="Wilaya"
              value={form.wilayaCode}
              onChange={(e) => {
                set('wilayaCode')(e);
                preview.reset();
              }}
              placeholder="Choisir"
              options={WILAYA_OPTIONS}
              required
            />
          ) : (
            <div />
          )}
          <Input label="Lien dans l’app (facultatif)" placeholder="ucolis://listings" pattern="ucolis://.*" value={form.link} onChange={set('link')} />
          <Input label="Programmer (vide = envoi immédiat)" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} />
          <div className="md:col-span-2">
            <TextArea label="Motif (journalisé)" value={form.reason} onChange={set('reason')} minLength={3} required />
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button variant="outline" onClick={() => preview.mutate()} loading={preview.isPending} disabled={form.kind === 'wilaya' && !form.wilayaCode}>
              Compter les destinataires
            </Button>
            {preview.data && <span className="text-sm">{preview.data.recipients} destinataire(s)</span>}
            <Button type="submit" loading={send.isPending}>
              Envoyer
            </Button>
            {sent && <span className="text-sm text-[#1F8F88]">{sent}</span>}
          </div>
          {(send.error || preview.error) && (
            <div className="md:col-span-2">
              <ErrorBox error={send.error ?? preview.error} />
            </div>
          )}
        </form>
      </Card>
      <Card title="Historique">
        <QueryState query={history}>
          {(d) => (
            <Table
              rows={d.items}
              rowKey={(b) => b._id}
              columns={[
                { header: 'Titre', cell: (b) => <div><div>{b.title.fr}</div><div dir="rtl" className="text-xs text-muted">{b.title.ar}</div></div> },
                { header: 'Segment', cell: (b) => (b.segment.kind === 'wilaya' ? wilaya(b.segment.wilayaCode) : SEGMENTS.find((s) => s.value === b.segment.kind)?.label) },
                { header: 'Envoi', cell: (b) => (b.sentAt ? dateTime(b.sentAt) : `Programmé : ${dateTime(b.scheduledAt)}`) },
                { header: 'Destinataires', cell: (b) => (b.sentAt ? b.recipients : '-') },
              ]}
            />
          )}
        </QueryState>
      </Card>
    </div>
  );
}
