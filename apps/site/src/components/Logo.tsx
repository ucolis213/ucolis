import { Package } from 'lucide-react';

/** Logo : cube blanc sur pastille de marque ; le nom reste en lettres latines dans toutes les langues. */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2" aria-label="UCOLIS" dir="ltr">
      <span className="grid size-9 place-items-center rounded-[11px] bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
        <Package className="size-5 text-white" strokeWidth={2.4} aria-hidden />
      </span>
      <span className={`font-['Bricolage_Grotesque'] text-[22px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-navy'}`}>
        u<span className={light ? 'text-accent' : 'text-primary'}>colis</span>
      </span>
    </span>
  );
}
