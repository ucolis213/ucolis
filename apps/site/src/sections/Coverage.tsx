import { MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { WILAYAS, getWilaya, haversineKm, type LatLng } from '@ucolis/shared';
import { Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { useI18n } from '../i18n';

// Projection simple (équirectangulaire) de l'emprise de l'Algérie sur un repère 600 × 560.
const BOX = { west: -8.8, east: 12.1, north: 37.3, south: 18.8 };
const W = 600;
const H = 560;
const project = ({ lat, lng }: LatLng) => ({
  x: 20 + ((lng - BOX.west) / (BOX.east - BOX.west)) * (W - 40),
  y: 20 + ((BOX.north - lat) / (BOX.north - BOX.south)) * (H - 40),
});

// Contour très simplifié du pays, décoratif (lng, lat).
const OUTLINE: [number, number][] = [
  [-2.2, 35.1], [0.5, 35.9], [2.0, 36.6], [5.0, 36.9], [8.6, 36.95], [8.3, 35.2], [7.8, 34.2], [7.5, 33.2],
  [9.5, 30.2], [9.9, 27.5], [9.7, 26.4], [10.3, 24.6], [11.98, 23.5], [7.4, 20.8], [5.8, 19.4], [3.2, 19.0],
  [3.2, 19.8], [1.1, 20.9], [-4.8, 25.0], [-8.67, 27.3], [-8.67, 28.7], [-5.0, 29.9], [-3.6, 31.6],
  [-1.2, 32.1], [-1.7, 33.3], [-1.8, 34.6],
];
const OUTLINE_PATH =
  OUTLINE.map(([lng, lat], i) => {
    const p = project({ lat, lng });
    return `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(' ') + ' Z';

const HUB = '16';
const ROUTES = ['31', '25', '30', '11', '08', '19'];

export function Coverage() {
  const { m, place, number } = useI18n();
  const [active, setActive] = useState(HUB);

  const dots = useMemo(() => {
    const hub = getWilaya(HUB)!.center;
    return WILAYAS.map((w) => ({ ...w, ...project(w.center), order: haversineKm(hub, w.center) })).sort((a, b) => a.order - b.order);
  }, []);
  const hubPoint = project(getWilaya(HUB)!.center);
  const current = getWilaya(active)!;

  return (
    <section className="bg-white px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.coverage.kicker} title={m.coverage.title} subtitle={m.coverage.subtitle} />
        <div className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          <Reveal className="relative rounded-[var(--radius-sheet)] bg-gradient-to-br from-background to-primary-soft p-4 ring-1 ring-border">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={m.coverage.title}>
              <defs>
                <radialGradient id="dot-glow">
                  <stop offset="0%" stopColor="#1A73E8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#1A73E8" stopOpacity="0" />
                </radialGradient>
              </defs>
              <motion.path
                d={OUTLINE_PATH}
                fill="#ffffff"
                stroke="#1A73E8"
                strokeOpacity="0.35"
                strokeWidth="2"
                strokeLinejoin="round"
                initial={{ pathLength: 0, fillOpacity: 0 }}
                whileInView={{ pathLength: 1, fillOpacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />

              {/* Liaisons depuis Alger vers quelques grandes wilayas. */}
              {ROUTES.map((code, i) => {
                const to = project(getWilaya(code)!.center);
                // Courbe bombée vers l'intérieur des terres (jamais vers la mer, hors du cadre).
                const dx = to.x - hubPoint.x;
                const dy = to.y - hubPoint.y;
                const flip = dx > 0 ? -1 : 1;
                const cx = (hubPoint.x + to.x) / 2 + flip * dy * 0.25;
                const cy = (hubPoint.y + to.y) / 2 + Math.abs(dx) * 0.25;
                const d = `M ${hubPoint.x} ${hubPoint.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x} ${to.y}`;
                return (
                  <g key={code}>
                    <motion.path
                      d={d}
                      fill="none"
                      stroke="#0EA5E9"
                      strokeWidth="2"
                      strokeDasharray="4 6"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 1.2 + i * 0.2, duration: 1.2 }}
                    />
                    <circle r="4" fill="#0EA5E9">
                      <animateMotion dur={`${3 + i * 0.4}s`} begin={`${2 + i * 0.3}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  </g>
                );
              })}

              {dots.map((w, i) => {
                const r = 4 + Math.min(6, w.communes.length / 12);
                const on = active === w.code;
                return (
                  <motion.g
                    key={w.code}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 + i * 0.025, type: 'spring', stiffness: 300, damping: 15 }}
                    style={{ transformOrigin: `${w.x}px ${w.y}px` }}
                    onMouseEnter={() => setActive(w.code)}
                    onFocus={() => setActive(w.code)}
                    onClick={() => setActive(w.code)}
                    tabIndex={0}
                    role="button"
                    aria-label={place(w)}
                    className="cursor-pointer outline-none"
                  >
                    <circle cx={w.x} cy={w.y} r={r * 3} fill="url(#dot-glow)" opacity={on ? 1 : 0.4} />
                    <circle
                      cx={w.x}
                      cy={w.y}
                      r={on ? r + 3 : r}
                      fill={on ? '#0E1B3D' : w.code === HUB ? '#1A73E8' : '#5B9BF0'}
                      stroke="#fff"
                      strokeWidth="2"
                      style={{ transition: 'r 0.2s, fill 0.2s' }}
                    />
                  </motion.g>
                );
              })}
            </svg>
          </Reveal>

          <Reveal delay={0.1}>
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[var(--radius-sheet)] bg-navy p-6 text-white shadow-2xl"
            >
              <p className="text-sm text-white/60">{m.coverage.hover}</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary font-mono text-lg font-bold" dir="ltr">
                  {current.code}
                </span>
                <div>
                  <p className="text-2xl font-extrabold">{place(current)}</p>
                  <p className="font-['Cairo'] text-white/70">{current.fr === place(current) ? current.ar : current.fr}</p>
                </div>
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm text-accent-soft">
                <MapPin className="size-4" aria-hidden />
                <span dir="ltr">{number(current.communes.length)}</span> {m.stats.communes}
              </p>
            </motion.div>
            <div className="mt-4 flex max-h-56 flex-wrap gap-2 overflow-y-auto pe-1">
              {WILAYAS.map((w) => (
                <button
                  key={w.code}
                  type="button"
                  onClick={() => setActive(w.code)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active === w.code ? 'bg-primary text-white' : 'bg-neutral-soft text-navy hover:bg-primary-soft'
                  }`}
                >
                  {place(w)}
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
