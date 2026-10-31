import { ArrowLeftRight, Info, MapPin, Navigation, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { TweenNumber } from '../components/AnimatedNumber';
import { CtaLink } from '../components/CtaLink';
import { Illustration } from '../components/Illustration';
import { Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { WilayaSelect } from '../components/WilayaSelect';
import { useI18n } from '../i18n';
import { useRoute } from '../route';
import { SIZE_PRESETS, estimate, type SizePreset } from '../simulator';

export function Simulator() {
  const { m, price, number, decimal } = useI18n();
  const { from, to, setFrom, setTo, swap } = useRoute();
  const [size, setSize] = useState<SizePreset>('small');
  const [fragile, setFragile] = useState(false);
  const [turns, setTurns] = useState(0);
  const result = useMemo(() => estimate(from, to, size, fragile), [from, to, size, fragile]);

  return (
    <section id="pricing" className="relative px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.simulator.kicker} title={m.simulator.title} subtitle={m.simulator.subtitle} />

        <Reveal className="grid gap-3 rounded-[var(--radius-panel)] bg-white p-3 shadow-2xl shadow-navy/[0.07] ring-1 ring-border lg:grid-cols-[1.25fr_1fr]">
          <div className="p-4 md:p-7">
            <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
              <WilayaSelect label={m.simulator.from} value={from} onChange={setFrom} icon={Navigation} iconClass="text-accent" />
              <motion.button
                type="button"
                onClick={() => {
                  swap();
                  setTurns((n) => n + 1);
                }}
                animate={{ rotate: turns * 180 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                className="mx-auto grid size-11 place-items-center rounded-full bg-navy text-white shadow-lg max-sm:rotate-90"
                aria-label={m.simulator.swap}
                title={m.simulator.swap}
              >
                <ArrowLeftRight className="size-4" />
              </motion.button>
              <WilayaSelect label={m.simulator.to} value={to} onChange={setTo} icon={MapPin} iconClass="text-navy" />
            </div>

            <fieldset className="mt-8">
              <legend className="mb-3 text-[11px] font-bold tracking-wider text-subtle uppercase">{m.simulator.size}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.keys(SIZE_PRESETS) as SizePreset[]).map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    aria-pressed={size === s}
                    className={`relative flex flex-col items-center rounded-2xl px-2 py-4 text-center transition ${
                      size === s ? 'text-white' : 'bg-neutral-soft text-navy hover:bg-primary-soft'
                    }`}
                  >
                    {size === s && (
                      <motion.span layoutId="size-pill" className="absolute inset-0 rounded-2xl bg-primary shadow-lg shadow-primary/30" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                    )}
                    {/* Pictogramme : un carton qui grandit avec la taille. */}
                    <span className="relative flex h-9 items-end" aria-hidden>
                      <span
                        className={`block rounded-[5px] border-t-4 ${size === s ? 'border-white/60 bg-white/30' : 'border-primary/40 bg-[#D9A066]'}`}
                        style={{ width: 12 + i * 6, height: 9 + i * 6 }}
                      />
                    </span>
                    <span className="relative mt-2 block text-sm font-bold">{m.simulator.sizes[s]}</span>
                    <span className={`relative block text-[11px] leading-tight ${size === s ? 'text-white/75' : 'text-muted'}`}>{m.simulator.sizeHints[s]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-warning-soft p-4">
              <span className="flex items-center gap-3 font-semibold text-navy">
                <ShieldAlert className="size-5 text-warning" aria-hidden />
                {m.simulator.fragile}
              </span>
              <input type="checkbox" checked={fragile} onChange={(e) => setFragile(e.target.checked)} className="peer sr-only" />
              <span className="relative h-7 w-12 shrink-0 rounded-full bg-border transition peer-checked:bg-warning peer-focus-visible:ring-2 peer-focus-visible:ring-primary" aria-hidden>
                <motion.span
                  layout
                  className={`absolute top-1 size-5 rounded-full bg-white shadow ${fragile ? 'end-1' : 'start-1'}`}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </span>
            </label>
          </div>

          <div className="relative flex flex-col overflow-hidden rounded-[32px] bg-navy p-6 text-white md:p-8">
            <div className="bg-dots-light absolute inset-0" aria-hidden />
            <div className="absolute -end-20 -top-20 size-72 rounded-full bg-primary/50 blur-3xl" aria-hidden />
            <div className="absolute -bottom-24 -start-16 size-64 rounded-full bg-accent/25 blur-3xl" aria-hidden />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white/60">{m.simulator.result}</p>
                <p className="display mt-2 text-6xl md:text-7xl" dir="ltr" aria-live="polite">
                  <TweenNumber value={result.price} format={price} />
                </p>
              </div>
              {/* Emplacement : illustration du simulateur (ILLUSTRATIONS.md, n° 10), sur pastille claire. */}
              <div className="w-24 shrink-0 rounded-3xl bg-white p-2 shadow-xl md:w-28">
                <Illustration name="simulator" />
              </div>
            </div>

            <dl className="relative mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                <dt className="text-xs text-white/60">{m.simulator.distance}</dt>
                <dd className="mt-1 text-xl font-bold">
                  {from === to ? m.simulator.sameCity : <span dir="ltr">{number(result.distanceKm)} km</span>}
                </dd>
              </div>
              <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                <dt className="text-xs text-white/60">{m.simulator.chargeable}</dt>
                <dd className="mt-1 text-xl font-bold" dir="ltr">
                  {decimal(result.chargeableKg)} kg
                </dd>
              </div>
            </dl>

            <p className="relative mt-5 flex gap-2 text-xs leading-relaxed text-white/60">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {m.simulator.disclaimer}
            </p>

            <CtaLink href="#download" variant="light" className="relative mt-8 w-full lg:mt-auto">
              {m.simulator.cta}
            </CtaLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
