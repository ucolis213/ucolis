import { BadgePercent, BellRing, Check, Route, Truck } from 'lucide-react';
import { motion } from 'motion/react';
import { CtaLink } from '../components/CtaLink';
import { Illustration } from '../components/Illustration';
import { Reveal, Stagger, staggerItem } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { useI18n } from '../i18n';

const ICONS = [Route, BellRing, BadgePercent];

export function Carriers() {
  const { m } = useI18n();
  const j = m.carriers.join;

  return (
    <section id="carriers" className="px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.carriers.kicker} title={m.carriers.title} subtitle={m.carriers.subtitle} />

        {/* Grande scène : le transporteur et son fourgon, avec la pastille « gratuit ». */}
        <Reveal className="relative rounded-[var(--radius-panel)] bg-white p-2 shadow-2xl shadow-navy/[0.07] ring-1 ring-border md:p-3">
          <div className="overflow-hidden rounded-[32px]">
            {/* Emplacement : transporteur et son fourgon (ILLUSTRATIONS.md, n° 12). */}
            <Illustration name="carriers" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20, rotate: -4 }}
            whileInView={{ opacity: 1, y: 0, rotate: -4 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, type: 'spring' }}
            className="absolute -top-5 end-6 rounded-2xl bg-warning px-5 py-3 text-navy shadow-xl shadow-warning/30 md:end-12"
          >
            <span className="display block text-xl">{j.free}</span>
          </motion.div>
        </Reveal>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <Stagger className="grid gap-4">
            {m.carriers.bullets.map((b, i) => {
              const Icon = ICONS[i]!;
              return (
                <motion.div key={i} variants={staggerItem} className="flex gap-5 rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-border">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-navy">{b.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{b.body}</p>
                  </div>
                </motion.div>
              );
            })}
          </Stagger>

          {/* Carte d'invitation : gratuité actuelle et avantages, sans détail de calcul des gains. */}
          <Reveal delay={0.1} className="relative flex flex-col overflow-hidden rounded-[var(--radius-sheet)] bg-gradient-to-br from-primary to-primary-dark p-7 text-white md:p-9">
            <div className="bg-dots-light absolute inset-0" aria-hidden />
            <div className="absolute -end-20 -bottom-20 size-72 rounded-full bg-accent/50 blur-3xl" aria-hidden />
            <h3 className="display relative flex items-center gap-3 text-3xl">
              <Truck className="size-8 shrink-0" aria-hidden />
              {j.title}
            </h3>
            <p className="relative mt-3 text-white/75">{j.freeBody}</p>
            <ul className="relative mt-6 space-y-3">
              {j.perks.map((p, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="flex items-start gap-3 font-semibold"
                >
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white text-primary">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  {p}
                </motion.li>
              ))}
            </ul>
            <CtaLink href="#download" variant="light" className="relative mt-8 w-full lg:mt-auto">
              {j.cta}
            </CtaLink>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
