import { ArrowLeft, FileText } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useI18n } from '../i18n';
import { LEGAL_DOCS, legalHref, parseMarkdown, type LegalDoc } from '../legal';

/** Page d'un document légal (CGU, confidentialité), dans la langue du site ; l'anglais affiche le français. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { m, locale } = useI18n();
  const lang = locale === 'ar' ? 'ar' : 'fr';
  const blocks = useMemo(() => parseMarkdown(LEGAL_DOCS[doc][lang]), [doc, lang]);
  const other: LegalDoc = doc === 'cgu' ? 'confidentialite' : 'cgu';

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [doc]);

  return (
    <main className="px-4 pt-32 pb-20 md:pt-40">
      <article lang={lang} className="mx-auto max-w-3xl rounded-[var(--radius-panel)] bg-white p-6 ring-1 ring-border md:p-12">
        <a href="#top" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-dark">
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {m.legalPage.back}
        </a>
        {locale === 'en' && <p className="mt-6 rounded-2xl bg-primary-soft p-4 text-sm font-semibold text-primary-dark">{m.legalPage.frArOnly}</p>}

        {blocks.map((b, i) => {
          switch (b.type) {
            case 'h1':
              return (
                <h1 key={i} className="display mt-8 text-4xl leading-tight text-navy md:text-5xl">
                  {b.text}
                </h1>
              );
            case 'h2':
              return (
                <h2 key={i} className="mt-10 text-xl font-bold text-navy">
                  {b.text}
                </h2>
              );
            case 'h3':
              return (
                <h3 key={i} className="mt-6 font-bold text-navy">
                  {b.text}
                </h3>
              );
            case 'ul':
              return (
                <ul key={i} className="mt-3 list-disc space-y-1.5 ps-6 leading-relaxed text-muted marker:text-primary">
                  {b.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              );
            default:
              return (
                <p key={i} className="mt-3 leading-relaxed text-muted">
                  {b.text}
                </p>
              );
          }
        })}

        <a
          href={legalHref(other)}
          className="mt-12 flex items-center gap-3 rounded-[var(--radius-card)] bg-background p-5 font-bold text-navy ring-1 ring-border transition hover:ring-primary/40"
        >
          <FileText className="size-5 text-primary" aria-hidden />
          {other === 'cgu' ? m.footer.terms : m.footer.privacy}
        </a>
      </article>
    </main>
  );
}
