import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

const VARIANTS = {
  primary: 'bg-primary text-white shadow-xl shadow-primary/30 hover:bg-primary-dark',
  dark: 'bg-navy text-white shadow-xl shadow-navy/20 hover:bg-ink',
  light: 'bg-white text-navy shadow-xl shadow-black/10 hover:bg-primary-soft',
  ghost: 'bg-white/70 text-navy ring-1 ring-border backdrop-blur hover:bg-white hover:ring-primary/40',
};

/** Bouton-lien principal : flèche qui glisse au survol, retournée en arabe. */
export function CtaLink({
  href,
  children,
  variant = 'primary',
  arrow = true,
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 font-bold transition duration-300 hover:-translate-y-0.5 ${VARIANTS[variant]} ${className}`}
    >
      {children}
      {arrow && (
        <span className="grid size-6 place-items-center rounded-full bg-current/15">
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden />
        </span>
      )}
    </a>
  );
}
