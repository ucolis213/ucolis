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
    <div className="relative rounded-[32px] bg-white p-3 shadow-2xl shadow-black/30">
      <div className="relative overflow-hidden rounded-3xl bg-[#eaf2fb]" dir="ltr">
        <svg viewBox="0 0 400 300" className="block h-auto w-full" role="img" aria-label={m.tracking.title}>
          {/* Fond de carte : îlots, routes secondaires et mer. */}
          <path d="M0 0 H400 V40 C 330 30, 260 50, 200 35 S 60 20, 0 30 Z" fill="#cfe5fb" />
          {[
            'M 20 140 L 380 120',
            'M 60 260 L 300 40',
            'M 0 210 C 120 190, 220 260, 400 200',
            'M 180 300 L 220 0',
          ].map((d) => (
            <path key={d} d={d} stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" />
          ))}
          {[
            [40, 180, 70, 50],
            [250, 230, 90, 50],
            [280, 70, 80, 55],
            [100, 210, 50, 40],
          ].map(([x, y, w, h]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="10" fill="#d9ecd8" />
          ))}

          {/* Itinéraire : trait de fond, puis trait animé qui se dessine. */}
          <path d={ROUTE} stroke="#1A73E8" strokeOpacity="0.18" strokeWidth="12" fill="none" strokeLinecap="round" />
          <motion.path
            d={ROUTE}
            stroke="#1A73E8"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="1 0"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 2, ease: 'easeInOut' }}
          />

          {/* Départ (bleu ciel) et arrivée (navy), comme dans l'application. */}
          <circle cx="340" cy="230" r="9" fill="#0EA5E9" stroke="#fff" strokeWidth="3" />
          <g transform="translate(60 60)">
            <circle r="16" fill="#0E1B3D" opacity="0.15">
              {!reduce && <animate attributeName="r" values="10;22;10" dur="2.4s" repeatCount="indefinite" />}
            </circle>
            <circle r="9" fill="#0E1B3D" stroke="#fff" strokeWidth="3" />
          </g>

          {/* Le fourgon suit le tracé. */}
          <g>
            <circle r="15" fill="#1A73E8" stroke="#fff" strokeWidth="3" />
            <path d="M -7 -3 h 8 v 7 h -8 z M 1 -1 h 4 l 2 3 v 2 h -6 z" fill="#fff" />
            {reduce ? null : (
              <animateMotion dur={`${LOOP_S}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path={ROUTE} />
            )}
          </g>
        </svg>

        <div className="absolute top-3 start-3 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-navy shadow" dir="auto">
          <span className="relative flex size-2.5">
            <span className="animate-ping-slow absolute inline-flex size-full rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
          </span>
          {m.tracking.live}
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 pt-4">
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
        <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent-dark">
          <Phone className="size-5" />
        </span>
        <span className="grid size-11 place-items-center rounded-full bg-primary text-white">
          <MessageCircle className="size-5" />
        </span>
      </div>
    </div>
  );
}

export function Tracking() {
  const { m } = useI18n();
  return (
    <section className="relative overflow-hidden bg-navy px-4 py-20 md:py-28">
      <div className="absolute -top-40 start-1/4 size-[30rem] rounded-full bg-primary/30 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 end-0 size-[26rem] rounded-full bg-accent/20 blur-3xl" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <div className="[&>div]:mx-0 [&>div]:text-start">
            <SectionHeading kicker={m.tracking.kicker} title={m.tracking.title} subtitle={m.tracking.body} light />
          </div>
          <ul className="-mt-6 space-y-4">
            {m.tracking.bullets.map((b, i) => (
              <motion.li
                key={b}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i, duration: 0.5 }}
                className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 text-white ring-1 ring-white/10"
              >
                <CheckCircle2 className="size-6 shrink-0 text-accent" aria-hidden />
                {b}
              </motion.li>
            ))}
          </ul>
        </div>
        <Reveal delay={0.15} className="mx-auto w-full max-w-md">
          <LiveMap />
        </Reveal>
      </div>
    </section>
  );
}
