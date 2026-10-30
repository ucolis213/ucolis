import { ArrowLeftRight, ArrowRight, Info, MapPin, Navigation, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useId, useMemo, useState } from 'react';
import { WILAYAS } from '@ucolis/shared';
import { TweenNumber } from '../components/AnimatedNumber';
import { Illustration } from '../components/Illustration';
import { Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { useI18n } from '../i18n';
import { SIZE_PRESETS, estimate, type SizePreset } from '../simulator';

function WilayaSelect({ label, value, onChange, icon: Icon }: { label: string; value: string; onChange: (v: string) => void; icon: typeof MapPin }) {
  const { place } = useI18n();
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-semibold text-muted">{label}</span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-primary" aria-hidden />
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-[14px] bg-neutral-soft py-3.5 ps-12 pe-4 font-semibold text-navy ring-1 ring-transparent transition outline-none focus:bg-white focus:ring-primary"
        >
          {WILAYAS.map((w) => (
            <option key={w.code} value={w.code}>
              {w.code} - {place(w)}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function Simulator() {
  const { m, price, number } = useI18n();
  const [from, setFrom] = useState('19');
  const [to, setTo] = useState('16');
  const [size, setSize] = useState<SizePreset>('small');
  const [fragile, setFragile] = useState(false);
  const [swaps, setSwaps] = useState(0);
  const result = useMemo(() => estimate(from, to, size, fragile), [from, to, size, fragile]);

  const swap = () => {
    setFrom(to);
    setTo(from);
    setSwaps((n) => n + 1);
  };

  return (
    <section id="pricing" className="relative overflow-hidden px-4 py-20 md:py-28">
      <div className="absolute top-1/3 start-1/2 -z-10 size-[40rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.simulator.kicker} title={m.simulator.title} subtitle={m.simulator.subtitle} />

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Reveal className="rounded-[var(--radius-sheet)] bg-white p-6 shadow-xl shadow-navy/5 ring-1 ring-border md:p-8">
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <WilayaSelect label={m.simulator.from} value={from} onChange={setFrom} icon={Navigation} />
              <motion.button
                type="button"
                onClick={swap}
                animate={{ rotate: swaps * 180 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/30"
                aria-label={m.simulator.swap}
                title={m.simulator.swap}
              >
                <ArrowLeftRight className="size-5" />
              </motion.button>
              <WilayaSelect label={m.simulator.to} value={to} onChange={setTo} icon={MapPin} />
            </div>

            <fieldset className="mt-8">
              <legend className="mb-3 text-sm font-semibold text-muted">{m.simulator.size}</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(Object.keys(SIZE_PRESETS) as SizePreset[]).map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    aria-pressed={size === s}
                    className={`relative rounded-2xl p-3 text-start transition ${
                      size === s ? 'text-white' : 'bg-neutral-soft text-navy hover:bg-primary-soft'
                    }`}
                  >
                    {size === s && (
                      <motion.span layoutId="size-pill" className="absolute inset-0 rounded-2xl bg-navy" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                    )}
                    <span className="relative flex items-end gap-0.5" aria-hidden>
                      {/* Pictogramme : un carton qui grandit avec la taille. */}
                      <span
                        className={`block rounded-[4px] ${size === s ? 'bg-accent' : 'bg-primary/70'}`}
                        style={{ width: 10 + i * 5, height: 8 + i * 5 }}
                      />
                    </span>
                    <span className="relative mt-2 block text-sm font-bold">{m.simulator.sizes[s]}</span>
                    <span className={`relative block text-[11px] ${size === s ? 'text-white/70' : 'text-muted'}`}>{m.simulator.sizeHints[s]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="mt-6 flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-warning-soft p-4">
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
          </Reveal>

          <Reveal delay={0.1} className="relative flex flex-col overflow-hidden rounded-[var(--radius-sheet)] bg-gradient-to-br from-primary to-primary-dark p-6 text-white shadow-2xl shadow-primary/30 md:p-8">
            <div className="absolute -top-16 -end-16 size-56 rounded-full bg-accent/40 blur-2xl" aria-hidden />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white/70">{m.simulator.result}</p>
                <p className="mt-1 text-5xl font-extrabold tracking-tight md:text-6xl" dir="ltr" aria-live="polite">
                  <TweenNumber value={result.price} format={price} />
                </p>
              </div>
              {/* Emplacement : illustration du simulateur (ILLUSTRATIONS.md, n° 10). */}
              <div className="w-28 shrink-0 md:w-36">
                <Illustration name="simulator" className="rounded-2xl" />
              </div>
            </div>

            <dl className="relative mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <dt className="text-xs text-white/70">{m.simulator.distance}</dt>
                <dd className="mt-1 text-xl font-bold">
                  {from === to ? m.simulator.sameCity : <span dir="ltr">{number(result.distanceKm)} km</span>}
                </dd>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <dt className="text-xs text-white/70">{m.simulator.chargeable}</dt>
                <dd className="mt-1 text-xl font-bold" dir="ltr">
                  {result.chargeableKg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg
                </dd>
              </div>
            </dl>

            <p className="relative mt-5 flex gap-2 text-xs leading-relaxed text-white/70">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {m.simulator.disclaimer}
            </p>

            <a
              href="#download"
              className="group relative mt-auto flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 pt-4 font-bold text-primary-dark shadow-lg transition hover:-translate-y-0.5 max-lg:mt-6 lg:mt-8"
            >
              {m.simulator.cta}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
