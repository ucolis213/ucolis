import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { WILAYAS } from '@ucolis/shared';
import { useI18n } from '../i18n';

/** Liste des 58 wilayas, avec code ; style « champ de recherche » (compact) ou « champ de formulaire ». */
export function WilayaSelect({
  label,
  value,
  onChange,
  icon: Icon,
  iconClass = 'text-primary',
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  icon: LucideIcon;
  iconClass?: string;
  compact?: boolean;
}) {
  const { place } = useI18n();
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`group relative flex min-w-0 items-center gap-3 transition ${
        compact ? 'rounded-full px-4 py-2.5 hover:bg-neutral-soft' : 'rounded-2xl bg-neutral-soft px-4 py-3 ring-1 ring-transparent focus-within:bg-white focus-within:ring-primary'
      }`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-border ${iconClass}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-wider text-subtle uppercase">{label}</span>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none truncate bg-transparent pe-5 font-bold text-navy outline-none"
        >
          {WILAYAS.map((w) => (
            <option key={w.code} value={w.code}>
              {w.code} - {place(w)}
            </option>
          ))}
        </select>
      </span>
      <ChevronDown className="pointer-events-none absolute end-4 size-4 text-subtle" aria-hidden />
    </label>
  );
}
