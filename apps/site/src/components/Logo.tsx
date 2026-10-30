import { Package } from 'lucide-react';

/** Logo : cube blanc sur pastille de marque ; le nom reste en lettres latines dans les deux langues. */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2" aria-label="UCOLIS" dir="ltr">
      <span className="grid size-10 place-items-center rounded-xl bg-primary shadow-lg shadow-primary/30">
        <Package className="size-6 text-white" strokeWidth={2.2} aria-hidden />
      </span>
      <span className={`font-['Inter'] text-2xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-navy'}`}>
        U<span className={light ? 'text-accent' : 'text-primary'}>COLIS</span>
      </span>
    </span>
  );
}
