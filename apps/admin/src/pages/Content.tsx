// Contenus éditoriaux (FAQ, CGU, confidentialité) en Markdown, par langue : brouillon puis publication.
// Publier les CGU crée une nouvelle version que chaque utilisateur doit accepter.

import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAction, useAdminQuery } from '../api/hooks';
import { Button, Card, ErrorBox, PageHeader, Pill, QueryState, ReasonDialog, Tabs } from '../components/ui';
import { dateTime } from '../format';

interface ContentRow {
  key: string;
  locale: 'fr' | 'ar';
  body: string;
  draft: string | null;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
}

const KEYS = [
  { key: 'faq', label: 'FAQ', hint: 'Rubriques en « # Rubrique », puis une question par titre « ## Question », suivie de sa réponse.' },
  { key: 'terms', label: 'CGU', hint: 'La publication crée une nouvelle version : les utilisateurs devront l’accepter à leur prochaine ouverture.' },
  { key: 'privacy', label: 'Confidentialité', hint: 'Page publique, accessible sans compte.' },
] as const;
type Key = (typeof KEYS)[number]['key'];

export function Content() {
  const query = useAdminQuery<{ items: ContentRow[] }>(['content'], '/content');
  const [key, setKey] = useState<Key>('faq');
  const [locale, setLocale] = useState<'fr' | 'ar'>('fr');
  return (
    <div>
      <PageHeader title="Contenus" />
      <Card>
        <Tabs value={key} onChange={setKey} tabs={KEYS.map((k) => ({ key: k.key, label: k.label }))} />
        <Tabs
          value={locale}
          onChange={setLocale}
          tabs={[
            { key: 'fr', label: 'Français' },
            { key: 'ar', label: 'العربية' },
          ]}
        />
        <p className="mb-4 text-sm text-muted">{KEYS.find((k) => k.key === key)?.hint}</p>
        <QueryState query={query}>
          {(d) => <Editor key={`${key}-${locale}`} contentKey={key} locale={locale} row={d.items.find((r) => r.key === key && r.locale === locale) ?? null} />}
        </QueryState>
      </Card>
    </div>
  );
}

function Editor({ contentKey, locale, row }: { contentKey: Key; locale: 'fr' | 'ar'; row: ContentRow | null }) {
  const [text, setText] = useState(row?.draft ?? row?.body ?? '');
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => setText(row?.draft ?? row?.body ?? ''), [row]);
  const save = useAction(() => api.put(`/content/${contentKey}/${locale}`, { body: text }), [['content']]);
  const publish = useAction(async (reason: string) => {
    await api.put(`/content/${contentKey}/${locale}`, { body: text });
    return api.post(`/content/${contentKey}/${locale}/publish`, { reason });
  }, [['content']]);
  const dirty = text !== (row?.draft ?? row?.body ?? '');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {row?.publishedAt ? <Pill tone="success">Version {row.version} publiée le {dateTime(row.publishedAt)}</Pill> : <Pill tone="warning">Jamais publié</Pill>}
        {row?.draft !== null && row?.draft !== undefined && <Pill tone="primary">Brouillon en cours</Pill>}
        {dirty && <Pill>Modifications non enregistrées</Pill>}
      </div>
      <div className="flex gap-2">
        <Button variant={preview ? 'outline' : 'primary'} onClick={() => setPreview(false)}>
          Éditer
        </Button>
        <Button variant={preview ? 'primary' : 'outline'} onClick={() => setPreview(true)}>
          Aperçu
        </Button>
      </div>
      {preview ? (
        <MarkdownPreview body={text} rtl={locale === 'ar'} />
      ) : (
        <textarea
          aria-label="Contenu en Markdown"
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          lang={locale}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="block min-h-[24rem] w-full rounded-lg border border-border p-3 font-mono text-sm outline-none focus:border-primary"
        />
      )}
      {(save.error || publish.error) && <ErrorBox error={save.error ?? publish.error} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!dirty}>
          Enregistrer le brouillon
        </Button>
        <Button onClick={() => setPublishing(true)} disabled={!text.trim()}>
          Publier
        </Button>
      </div>
      <ReasonDialog
        open={publishing}
        title="Publier le contenu"
        description={contentKey === 'terms' ? 'Nouvelle version des CGU : tous les utilisateurs devront l’accepter.' : 'Le contenu est visible immédiatement dans l’application.'}
        confirmLabel="Publier"
        onClose={() => setPublishing(false)}
        onConfirm={publish.mutateAsync}
      />
    </div>
  );
}

/** Même rendu minimal que l'application (titres, listes, paragraphes). */
function MarkdownPreview({ body, rtl }: { body: string; rtl: boolean }) {
  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="min-h-[24rem] space-y-3 rounded-lg border border-border p-4 text-sm">
      {body
        .trim()
        .split(/\n{2,}/)
        .map((block, i) => {
          const h = /^(#{1,3})\s+(.*)$/.exec(block);
          if (h) return h[1]!.length === 1 ? <h2 key={i} className="text-xl font-bold">{h[2]}</h2> : <h3 key={i} className="text-lg font-semibold">{h[2]}</h3>;
          const lines = block.split('\n');
          if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
            return (
              <ul key={i} className="list-disc ps-5">
                {lines.map((l, j) => (
                  <li key={j}>{l.replace(/^\s*[-*]\s+/, '')}</li>
                ))}
              </ul>
            );
          }
          return <p key={i}>{lines.join(' ').replace(/\*\*(.+?)\*\*/g, '$1')}</p>;
        })}
    </div>
  );
}
