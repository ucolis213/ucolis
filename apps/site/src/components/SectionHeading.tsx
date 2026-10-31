import { Reveal } from './Reveal';

/** Titre de section : sur-titre en pastille, grand titre d'affichage, chapeau. */
export function SectionHeading({
  kicker,
  title,
  subtitle,
  light = false,
  align = 'center',
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  light?: boolean;
  align?: 'center' | 'start';
}) {
  const centered = align === 'center';
  return (
    <Reveal className={`mb-12 max-w-3xl md:mb-16 ${centered ? 'mx-auto text-center' : 'text-start'}`}>
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wider uppercase ${
          light ? 'bg-white/10 text-accent-soft ring-1 ring-white/15' : 'bg-white text-primary-dark shadow-sm ring-1 ring-border'
        }`}
      >
        <span className={`size-1.5 rounded-full ${light ? 'bg-accent' : 'bg-primary'}`} aria-hidden />
        {kicker}
      </span>
      <h2 className={`display mt-5 text-4xl leading-[1.05] text-balance md:text-6xl ${light ? 'text-white' : 'text-navy'}`}>{title}</h2>
      {subtitle && (
        <p className={`mt-5 text-lg leading-relaxed text-pretty ${centered ? 'mx-auto max-w-2xl' : 'max-w-xl'} ${light ? 'text-white/65' : 'text-muted'}`}>
          {subtitle}
        </p>
      )}
    </Reveal>
  );
}
