import { Bell, Calculator, Handshake, KeyRound, Languages, MapPinned, MessageCircle, Zap, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { MouseEvent, ReactNode } from 'react';
import { Stagger, staggerItem } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { useI18n } from '../i18n';

const ICONS: LucideIcon[] = [Zap, Calculator, Handshake, MapPinned, MessageCircle, KeyRound, Bell, Languages];

/** Halo qui suit le pointeur sur la carte. */
function onSpotlight(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
}

/** Mini-écran de publication : les champs se remplissent l'un après l'autre. */
function QuickPublishMock() {
  const { m, price } = useI18n();
  const rows = [m.simulator.from, m.simulator.to, m.simulator.result];
  return (
    <div className="relative mt-8 rounded-3xl bg-white/5 p-3 ring-1 ring-white/10 lg:mt-auto">
      <div className="space-y-2">
        {rows.map((label, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.2 }}
            className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-sm"
          >
            <span className="text-white/60">{label}</span>
            {i === 2 ? (
              <span className="font-bold text-white">{price(1500)}</span>
            ) : (
              <span className="inline-block h-2 w-20 rounded-full bg-white/25" />
            )}
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 1 }}
        className="mt-3 rounded-2xl bg-primary py-3 text-center text-sm font-bold text-white"
      >
        {m.simulator.cta}
      </motion.div>
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
    <div className="mt-6 flex flex-col gap-2">
      {rounds.map((r, i) => (
        <motion.span
          key={r.amount}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.25, type: 'spring' }}
          className={`w-fit rounded-2xl px-4 py-2 text-sm font-bold ${r.mine ? 'self-end bg-primary text-white' : 'bg-neutral-soft text-navy'} ${
            i === 2 ? 'ring-2 ring-accent ring-offset-2' : ''
          }`}
        >
          {price(r.amount)}
        </motion.span>
      ))}
    </div>
  );
}

/** Mini-trajet qui se dessine. */
function RouteMock() {
  return (
    <svg viewBox="0 0 300 90" className="mt-6 h-auto w-full" aria-hidden>
      <motion.path
        d="M 12 70 C 80 70, 90 20, 150 30 S 240 70, 288 20"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeDasharray="2 8"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease: 'easeInOut' }}
      />
      <circle cx="12" cy="70" r="7" fill="white" />
      <circle cx="288" cy="20" r="9" fill="#0E1B3D" stroke="white" strokeWidth="3" />
    </svg>
  );
}

/** Les 4 cases du code de remise. */
function CodeMock() {
  return (
    <div className="mt-6 flex gap-2" dir="ltr" aria-hidden>
      {['4', '8', '2', '7'].map((d, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.12 }}
          className="display grid size-12 place-items-center rounded-xl bg-primary-soft text-2xl text-primary-dark ring-1 ring-primary/20"
        >
          {d}
        </motion.span>
      ))}
    </div>
  );
}

const TILE = {
  white: 'bg-white ring-1 ring-border',
  navy: 'bg-navy text-white',
  blue: 'bg-gradient-to-br from-primary to-accent text-white',
};

export function Features() {
  const { m } = useI18n();
  // 4 colonnes : publication sur 2 × 2 cases, suivi GPS sur 2 cases, soit 3 rangées pleines.
  const layout: Record<number, { span?: string; tone: keyof typeof TILE; extra?: ReactNode }> = {
    0: { span: 'sm:col-span-2 lg:row-span-2', tone: 'navy', extra: <QuickPublishMock /> },
    2: { tone: 'white', extra: <NegotiationMock /> },
    3: { span: 'sm:col-span-2', tone: 'blue', extra: <RouteMock /> },
    5: { tone: 'white', extra: <CodeMock /> },
  };

  return (
    <section id="features" className="px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.features.kicker} title={m.features.title} subtitle={m.features.subtitle} />
        <Stagger className="grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {m.features.items.map((f, i) => {
            const Icon = ICONS[i]!;
            const { span = '', tone = 'white', extra } = layout[i] ?? {};
            const dark = tone !== 'white';
            return (
              <motion.article
                key={i}
                variants={staggerItem}
                onMouseMove={onSpotlight}
                className={`group relative flex flex-col overflow-hidden rounded-[var(--radius-sheet)] p-7 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 ${TILE[tone]} ${span}`}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(360px circle at var(--x) var(--y), ${dark ? 'rgb(255 255 255 / 0.12)' : 'rgb(26 115 232 / 0.1)'}, transparent 70%)`,
                  }}
                  aria-hidden
                />
                {tone === 'navy' && <div className="absolute -end-24 -top-24 size-72 rounded-full bg-primary/40 blur-3xl" aria-hidden />}
                <span
                  className={`relative grid size-12 shrink-0 place-items-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${
                    dark ? 'bg-white/15 text-white ring-1 ring-white/20' : 'bg-primary-soft text-primary'
                  }`}
                >
                  <Icon className="size-6" />
                </span>
                <h3 className={`display relative mt-6 text-2xl ${dark ? 'text-white' : 'text-navy'}`}>{f.title}</h3>
                <p className={`relative mt-2 leading-relaxed ${dark ? 'text-white/70' : 'text-muted'}`}>{f.body}</p>
                {extra}
              </motion.article>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
