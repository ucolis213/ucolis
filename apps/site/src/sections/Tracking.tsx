import { CheckCircle2, MessageCircle, Phone, Truck } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { interpolate, useI18n } from '../i18n';

// Tracé stylisé Sétif → Alger dans la carte (repère 400 × 300, non inversé en arabe : c'est une carte).
const ROUTE = 'M 340 230 C 300 220, 290 170, 240 160 S 170 120, 130 110 S 80 70, 60 60';
const LOOP_S = 9;
const TOTAL_KM = 82;

function LiveMap() {
  const { m } = useI18n();
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => (t + 1) % LOOP_S), 1000);
    return () => clearInterval(id);
  }, [reduce]);

  const remaining = Math.max(1, Math.round(TOTAL_KM * (1 - tick / LOOP_S)));

  return (
    // Cadre de téléphone : écran de suivi de l'application.
    <div className="relative mx-auto w-full max-w-sm rounded-[48px] bg-ink p-3 shadow-2xl shadow-black/50 ring-1 ring-white/15">
      <div className="absolute top-5 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-ink" aria-hidden />
      <div className="overflow-hidden rounded-[38px] bg-white">
        <div className="relative bg-[#eaf2fb]" dir="ltr">
          <svg viewBox="0 0 400 420" className="block h-auto w-full" role="img" aria-label={m.tracking.title}>
            {/* Fond de carte : mer, routes secondaires et îlots. */}
            <path d="M0 0 H400 V60 C 330 50, 260 70, 200 55 S 60 40, 0 50 Z" fill="#cfe5fb" />
            {['M 20 200 L 380 170', 'M 60 380 L 300 60', 'M 0 300 C 120 280, 220 350, 400 290', 'M 180 420 L 220 0'].map((d) => (
              <path key={d} d={d} stroke="#fff" strokeWidth="10" fill="none" strokeLinecap="round" />
            ))}
            {[
              [40, 240, 70, 50],
              [250, 320, 90, 60],
              [280, 100, 80, 55],
              [100, 310, 50, 40],
            ].map(([x, y, w, h]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="12" fill="#d9ecd8" />
            ))}

            <g transform="translate(0 50)">
              {/* Itinéraire : trait de fond, puis trait animé qui se dessine. */}
              <path d={ROUTE} stroke="#1A73E8" strokeOpacity="0.18" strokeWidth="14" fill="none" strokeLinecap="round" />
              <motion.path
                d={ROUTE}
                stroke="#1A73E8"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />

              {/* Départ (bleu ciel) et arrivée (navy), comme dans l'application. */}
              <circle cx="340" cy="230" r="9" fill="#0EA5E9" stroke="#fff" strokeWidth="3" />
              <g transform="translate(60 60)">
                <circle r="16" fill="#0E1B3D" opacity="0.15">
                  {!reduce && <animate attributeName="r" values="10;24;10" dur="2.4s" repeatCount="indefinite" />}
                </circle>
                <circle r="9" fill="#0E1B3D" stroke="#fff" strokeWidth="3" />
              </g>

              {/* Le fourgon suit le tracé. */}
              <g>
                <circle r="16" fill="#1A73E8" stroke="#fff" strokeWidth="3" />
                <path d="M -7 -3 h 8 v 7 h -8 z M 1 -1 h 4 l 2 3 v 2 h -6 z" fill="#fff" />
                {reduce ? null : (
                  <animateMotion dur={`${LOOP_S}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path={ROUTE} />
                )}
              </g>
            </g>
          </svg>

          <div className="absolute top-12 start-4 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-navy shadow" dir="auto">
            <span className="relative flex size-2.5">
              <span className="animate-ping-slow absolute inline-flex size-full rounded-full bg-danger opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
            </span>
            {m.tracking.live}
          </div>
        </div>

        <div className="flex items-center gap-3 p-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Truck className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-navy">{m.tracking.carrier}</p>
            <p className="truncate text-xs text-muted">{m.tracking.vehicle}</p>
            <p className="mt-0.5 text-xs font-semibold text-accent-dark">
              {interpolate(m.tracking.updated, { s: (tick % 4) + 1 })} · {interpolate(m.tracking.remaining, { km: remaining })}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent-dark">
            <Phone className="size-4" />
          </span>
          <span className="grid size-10 place-items-center rounded-full bg-primary text-white">
            <MessageCircle className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

export function Tracking() {
  const { m } = useI18n();
  return (
    <section className="px-3 py-6 md:px-4">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[var(--radius-panel)] bg-navy px-5 py-20 md:px-12 md:py-28">
        <div className="bg-dots-light absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" aria-hidden />
        <div className="absolute -top-40 start-1/4 size-[34rem] rounded-full bg-primary/35 blur-[120px]" aria-hidden />
        <div className="absolute -bottom-40 end-0 size-[28rem] rounded-full bg-accent/25 blur-[120px]" aria-hidden />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading kicker={m.tracking.kicker} title={m.tracking.title} subtitle={m.tracking.body} light align="start" />
            <ul className="-mt-4 space-y-3">
              {m.tracking.bullets.map((b, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * i, duration: 0.5 }}
                  className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-4 text-white ring-1 ring-white/10 backdrop-blur"
                >
                  <CheckCircle2 className="size-6 shrink-0 text-accent" aria-hidden />
                  {b}
                </motion.li>
              ))}
            </ul>
          </div>
          <Reveal delay={0.15}>
            <LiveMap />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
