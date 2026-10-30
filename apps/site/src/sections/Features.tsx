import { Bell, Calculator, Handshake, KeyRound, Languages, MapPinned, MessageCircle, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import type { MouseEvent, ReactNode } from 'react';
import { Stagger, staggerItem } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { useI18n } from '../i18n';

const ICONS = [Zap, Calculator, Handshake, MapPinned, MessageCircle, KeyRound, Bell, Languages];
const TONES = [
  'bg-primary-soft text-primary',
  'bg-warning-soft text-warning',
  'bg-accent-soft text-accent-dark',
  'bg-primary-soft text-primary',
  'bg-accent-soft text-accent-dark',
  'bg-warning-soft text-warning',
  'bg-primary-soft text-primary',
  'bg-accent-soft text-accent-dark',
];

/** Halo qui suit le pointeur sur la carte. */
function onSpotlight(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
}

/** Mini-écran de publication rapide : les champs se remplissent l'un après l'autre. */
function QuickPublishMock() {
  const { m, price } = useI18n();
  const rows = [m.simulator.from, m.simulator.to, m.simulator.result];
  return (
    <div className="mt-6 space-y-2">
      {rows.map((label, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.2 }}
          className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5 text-sm ring-1 ring-border"
        >
          <span className="text-muted">{label}</span>
          <span className="font-bold text-navy">{i === 2 ? price(1500) : <span className="inline-block h-2 w-16 rounded-full bg-primary/20" />}</span>
        </motion.div>
      ))}
    </div>
  );
}

/** Mini-historique de négociation. */
function NegotiationMock() {
  const { price } = useI18n();
  const rounds = [
    { amount: 1800, mine: false },
    { amount: 1400, mine: true },
    { amount: 1500, mine: false },
  ];
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      {rounds.map((r, i) => (
        <motion.span
          key={r.amount}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.25, type: 'spring' }}
          className={`w-fit rounded-2xl px-4 py-2 text-sm font-bold ${
            r.mine ? 'bg-primary text-white' : 'bg-neutral-soft text-navy'
          } ${i === 2 ? 'ring-2 ring-accent ring-offset-2' : ''}`}
        >
          {price(r.amount)}
        </motion.span>
      ))}
    </div>
  );
}

export function Features() {
  const { m } = useI18n();
  const extras: Record<number, ReactNode> = { 0: <QuickPublishMock />, 2: <NegotiationMock /> };
  // 4 colonnes : la première carte occupe 2 × 2 cases et la négociation 2 cases, soit 3 rangées pleines.
  const spans: Record<number, string> = { 0: 'sm:col-span-2 lg:row-span-2', 2: 'sm:col-span-2' };

  return (
    <section id="features" className="bg-white px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.features.kicker} title={m.features.title} subtitle={m.features.subtitle} />
        <Stagger className="grid grid-flow-dense gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {m.features.items.map((f, i) => {
            const Icon = ICONS[i]!;
            return (
              <motion.article
                key={f.title}
                variants={staggerItem}
                onMouseMove={onSpotlight}
                className={`group relative overflow-hidden rounded-[var(--radius-card)] bg-background p-6 ring-1 ring-border transition hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 ${spans[i] ?? ''}`}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: 'radial-gradient(320px circle at var(--x) var(--y), rgb(26 115 232 / 0.12), transparent 70%)' }}
                  aria-hidden
                />
                <motion.span
                  whileHover={{ rotate: -8, scale: 1.1 }}
                  className={`relative grid size-12 place-items-center rounded-2xl ${TONES[i]}`}
                >
                  <Icon className="size-6" />
                </motion.span>
                <h3 className="relative mt-5 text-lg font-bold text-navy">{f.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
                {extras[i]}
              </motion.article>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
