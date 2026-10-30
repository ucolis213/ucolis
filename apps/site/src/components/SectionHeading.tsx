import { Reveal } from './Reveal';

export function SectionHeading({
  kicker,
  title,
  subtitle,
  light = false,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  light?: boolean;
}) {
  return (
    <Reveal className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
      <span
        className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${
          light ? 'bg-white/10 text-accent-soft ring-1 ring-white/20' : 'bg-primary-soft text-primary-dark'
        }`}
      >
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {kicker}
      </span>
      <h2
        className={`mt-4 text-3xl font-extrabold tracking-tight text-balance md:text-5xl ${light ? 'text-white' : 'text-navy'}`}
      >
        {title}
      </h2>
      {subtitle && <p className={`mt-4 text-lg text-pretty ${light ? 'text-white/70' : 'text-muted'}`}>{subtitle}</p>}
    </Reveal>
  );
}
