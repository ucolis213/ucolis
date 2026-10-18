// Briques d'interface du back-office : boutons, cartes, tableaux, pagination, dialogues de motif.

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router';
import { errorText } from '../api/client';

type Variant = 'primary' | 'outline' | 'danger' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  outline: 'border border-border bg-surface hover:bg-background',
  danger: 'bg-danger text-white hover:opacity-90',
  ghost: 'text-muted hover:bg-background',
};

export function Button({ variant = 'primary', loading, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {loading ? '…' : children}
    </button>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card bg-surface p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, back, actions, children }: { title: ReactNode; back?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 space-y-2">
      {back && (
        <Link to={back} className="text-sm text-muted hover:text-navy">
          ← Retour
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

const TONES = {
  neutral: 'bg-background text-navy',
  primary: 'bg-primary-soft text-primary-dark',
  success: 'bg-[#E6F8F7] text-[#1F8F88]',
  warning: 'bg-[#FEF5E6] text-[#B7791F]',
  danger: 'bg-[#FDECEC] text-danger',
} as const;
export type Tone = keyof typeof TONES;

export function Pill({ tone = 'neutral', children, style }: { tone?: Tone; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`} style={style}>
      {children}
    </span>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Loading() {
  return <p className="py-8 text-center text-sm text-muted">Chargement…</p>;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-[#FDECEC] p-4 text-sm text-danger">
      {errorText(error)}
      {onRetry && (
        <button className="ms-3 underline" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Empty({ children = 'Aucun élément.' }: { children?: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>;
}

/** Affiche chargement, erreur ou contenu d'une requête TanStack. */
export function QueryState<T>({ query, children }: { query: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown }; children: (data: T) => ReactNode }) {
  if (query.isPending) return <Loading />;
  if (query.error || query.data === undefined) return <ErrorBox error={query.error} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** Tableau défilant horizontalement sur mobile ; une ligne cliquable si `to` est fourni. */
export function Table<T>({ rows, columns, rowKey, onRowClick, empty }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; empty?: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase text-muted">
            {columns.map((c) => (
              <th key={c.header} className={`px-5 py-2 font-medium ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              className={`border-b border-border last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-background' : ''}`}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              {columns.map((c) => (
                <td key={c.header} className={`px-5 py-3 align-top ${c.className ?? ''}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>
        {total} résultat{total > 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Précédent
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Suivant
        </Button>
      </div>
    </div>
  );
}

const fieldClass = 'mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary';

export function Input({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input {...rest} className={fieldClass} />
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <textarea {...rest} className={`${fieldClass} min-h-24`} />
    </label>
  );
}

export function SelectField({ label, options, placeholder, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select {...rest} className={fieldClass}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Fenêtre modale accessible (dialog natif). */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card bg-surface p-0 text-navy shadow-xl backdrop:bg-navy/40"
    >
      {open && (
        <div className="space-y-4 p-6">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

/**
 * Action motivée : chaque écriture du staff exige un motif (3 caractères minimum), journalisé dans l'audit.
 * `extra` permet d'ajouter des champs (date de fin de suspension, statut forcé…).
 */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  danger,
  optionalReason,
  reasonLabel = 'Motif (journalisé)',
  extra,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  optionalReason?: boolean;
  reasonLabel?: string;
  extra?: ReactNode;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);
  const valid = optionalReason || reason.trim().length >= 3;
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setPending(true);
          setError(null);
          try {
            await onConfirm(reason.trim());
            onClose();
          } catch (err) {
            setError(err);
          } finally {
            setPending(false);
          }
        }}
      >
        {description && <div className="text-sm text-muted">{description}</div>}
        {extra}
        <TextArea label={reasonLabel} value={reason} onChange={(e) => setReason(e.target.value)} required={!optionalReason} minLength={optionalReason ? undefined : 3} maxLength={1000} />
        {error !== null && <ErrorBox error={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={pending} disabled={!valid}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Tabs<K extends string>({ value, onChange, tabs }: { value: K; onChange: (k: K) => void; tabs: { key: K; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${value === tab.key ? 'border-primary text-primary-dark' : 'border-transparent text-muted hover:text-navy'}`}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ms-1 text-xs">({tab.count})</span>}
        </button>
      ))}
    </div>
  );
}

export function Filters({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
