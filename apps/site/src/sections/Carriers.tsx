import { BellRing, Gift, Route, Wallet, BadgePercent } from 'lucide-react';
import { motion } from 'motion/react';
import { useId, useMemo, useState } from 'react';
import { DEFAULT_COMMISSION, commissionBreakdown, commissionTierRanges } from '@ucolis/shared';
import { TweenNumber } from '../components/AnimatedNumber';
import { Illustration } from '../components/Illustration';
import { Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { interpolate, useI18n } from '../i18n';

const ICONS = [Route, BellRing, BadgePercent];
const TIERS = commissionTierRanges(DEFAULT_COMMISSION.tiers);

/** Carte des gains : grille prévue et calcul des gains nets, avec la mention de gratuité actuelle. */
function EarningsCard() {
  const { m, price } = useI18n();
  const e = m.carriers.earnings;
  const id = useId();
  const [gross, setGross] = useState(1500);
  const b = useMemo(() => commissionBreakdown(gross), [gross]);
  const activeTier = TIERS.findIndex((t) => t.upTo === null || gross <= t.upTo);

  return (
    <div className="rounded-[var(--radius-sheet)] bg-white p-6 shadow-2xl shadow-navy/10 ring-1 ring-border md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xl font-bold text-navy">
          <Wallet className="size-6 text-primary" aria-hidden />
          {e.title}
        </h3>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-dark">{e.free}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{e.freeBody}</p>

      <label htmlFor={id} className="mt-6 flex items-center justify-between text-sm font-semibold text-muted">
        {e.price}
        <span className="text-lg font-extrabold text-navy" dir="ltr">
          {price(gross)}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={300}
        max={15000}
        step={100}
        value={gross}
        onChange={(ev) => setGross(Number(ev.target.value))}
        className="mt-2 w-full accent-primary"
      />

      <p className="mt-5 text-xs font-bold tracking-wide text-subtle uppercase">{e.gridTitle}</p>
      <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
        {TIERS.map((t, i) => (
          <li
            key={t.ratePercent}
            className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${
              i === activeTier ? 'bg-primary text-white' : 'bg-neutral-soft text-navy'
            }`}
          >
            <span className="text-xs">
              {t.from === null
                ? interpolate(e.below, { amount: price((t.upTo ?? 0) + 1) })
                : t.upTo === null
                  ? interpolate(e.above, { amount: price(t.from - 1) })
                  : interpolate(e.between, { from: price(t.from), to: price(t.upTo) })}
            </span>
            <b>{t.ratePercent} %</b>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{interpolate(e.fixedFee, { amount: price(DEFAULT_COMMISSION.fixedFee) })}</p>

      <div className="mt-5 flex items-center justify-between rounded-2xl bg-gradient-to-r from-accent-soft to-primary-soft p-4">
        <span className="font-semibold text-navy">{e.net}</span>
        <span className="text-2xl font-extrabold text-accent-dark" dir="ltr">
          <TweenNumber value={b.netEarnings} format={price} />
        </span>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary-dark">
        <Gift className="size-4" aria-hidden />
        {interpolate(e.bonus, { amount: price(DEFAULT_COMMISSION.welcomeBonus) })}
      </p>
    </div>
  );
}

export function Carriers() {
  const { m } = useI18n();
  return (
    <section id="carriers" className="bg-white px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.carriers.kicker} title={m.carriers.title} subtitle={m.carriers.subtitle} />
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <Reveal className="relative mb-8 overflow-hidden rounded-[var(--radius-sheet)] bg-gradient-to-br from-primary-soft to-accent-soft p-4">
              {/* Emplacement : transporteur et son fourgon (ILLUSTRATIONS.md, n° 12). */}
              <Illustration name="carriers" />
            </Reveal>
            <ul className="space-y-4">
              {m.carriers.bullets.map((b, i) => {
                const Icon = ICONS[i]!;
                return (
                  <motion.li
                    key={b.title}
                    initial={{ opacity: 0, x: -24 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex gap-4"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-navy">{b.title}</h3>
                      <p className="mt-1 text-sm text-muted">{b.body}</p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>
          <Reveal delay={0.1} className="lg:sticky lg:top-28">
            <EarningsCard />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
