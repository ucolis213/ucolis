import { ArrowLeftRight, BadgeCheck, CheckCircle2, MapPin, Navigation, Search, Star, Tag } from 'lucide-react';
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { WILAYAS } from '@ucolis/shared';
import { Illustration } from '../components/Illustration';
import { EASE } from '../components/Reveal';
import { WilayaSelect } from '../components/WilayaSelect';
import { useI18n } from '../i18n';
import { useRoute } from '../route';

/** Recherche de trajet façon site de réservation : elle pré-remplit le simulateur de prix. */
function RouteSearch() {
  const { m } = useI18n();
  const { from, to, setFrom, setTo, swap } = useRoute();
  const [turns, setTurns] = useState(0);

  return (
    <div className="mx-auto mt-10 w-full max-w-3xl rounded-[28px] bg-white p-2 shadow-2xl shadow-navy/10 ring-1 ring-border md:rounded-full">
      <div className="grid items-center gap-1 md:grid-cols-[1fr_auto_1fr_auto]">
        <WilayaSelect compact label={m.simulator.from} value={from} onChange={setFrom} icon={Navigation} iconClass="text-accent" />
        <motion.button
          type="button"
          onClick={() => {
            swap();
            setTurns((n) => n + 1);
          }}
          animate={{ rotate: turns * 180 }}
          whileTap={{ scale: 0.9 }}
          className="mx-auto grid size-10 place-items-center rounded-full bg-neutral-soft text-navy transition-colors hover:bg-primary-soft hover:text-primary max-md:rotate-90"
          aria-label={m.simulator.swap}
          title={m.simulator.swap}
        >
          <ArrowLeftRight className="size-4" />
        </motion.button>
        <WilayaSelect compact label={m.simulator.to} value={to} onChange={setTo} icon={MapPin} iconClass="text-navy" />
        <a
          href="#pricing"
          className="group flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-7 font-bold text-white shadow-lg shadow-primary/30 transition hover:bg-primary-dark"
        >
          <Search className="size-5 transition-transform group-hover:scale-110" aria-hidden />
          {m.hero.ctaSecondary}
        </a>
      </div>
    </div>
  );
}

function Chip({
  icon: Icon,
  tone,
  title,
  body,
  className,
  delay,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  body: string;
  className: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.8, ease: EASE }}
      className={`absolute z-10 hidden md:block ${className}`}
    >
      <div
        className="animate-float flex items-center gap-3 rounded-2xl bg-white/90 p-3 pe-5 shadow-2xl shadow-navy/15 ring-1 ring-white backdrop-blur-xl"
        style={{ animationDelay: `${delay}s` }}
      >
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
          <Icon className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold text-navy">{title}</span>
          <span className="block text-xs text-muted">{body}</span>
        </span>
      </div>
    </motion.div>
  );
}

export function Hero() {
  const { m, place } = useI18n();
  const c = m.hero.cards;
  const stage = useRef<HTMLDivElement>(null);
  // L'image se redresse et grandit en arrivant à l'écran, comme une scène qui s'ouvre.
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start end', 'start 0.35'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);

  // Notification qui change toutes les 3 s, comme sur le téléphone.
  const toasts = [
    { icon: Tag, title: c.offerTitle, body: c.offerBody },
    { icon: MapPin, title: c.trackTitle, body: c.trackBody },
    { icon: CheckCircle2, title: c.doneTitle, body: c.doneBody },
    { icon: Star, title: c.ratingTitle, body: c.ratingBody },
  ];
  const [toast, setToast] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setToast((i) => (i + 1) % toasts.length), 3000);
    return () => clearInterval(id);
  }, [toasts.length]);
  const current = toasts[toast]!;
  const ToastIcon = current.icon;

  const words = [m.hero.titleStart, m.hero.titleHighlight, m.hero.titleEnd];

  return (
    <section id="top" className="relative overflow-hidden pt-32 md:pt-40">
      {/* Fond : trame de points et halos de couleur. */}
      <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px]" aria-hidden>
        <div className="absolute -top-40 start-[-10%] size-[36rem] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-20 end-[-10%] size-[32rem] rounded-full bg-accent/25 blur-[120px]" />
        <div className="absolute top-[28rem] start-1/3 size-[24rem] rounded-full bg-warning/15 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 text-center">
        <motion.a
          href="#coverage"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2.5 rounded-full bg-white/80 py-1.5 ps-2 pe-4 text-sm font-semibold text-navy shadow-sm ring-1 ring-border backdrop-blur transition hover:ring-primary/40"
        >
          <span className="relative flex size-2.5">
            <span className="animate-ping-slow absolute inline-flex size-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
          </span>
          {m.hero.badge}
        </motion.a>

        <h1 className="display mx-auto mt-7 max-w-5xl text-[clamp(2.6rem,6.4vw,5.6rem)] leading-[1] text-balance text-navy">
          {words.map((w, i) => (
            <motion.span
              key={`${i}-${w}`}
              initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.1 + i * 0.14, duration: 0.9, ease: EASE }}
              className={`inline ${i === 1 ? 'text-gradient' : ''}`}
            >
              {w}{' '}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.7 }}
          className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-pretty text-muted md:text-xl"
        >
          {m.hero.subtitle}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8, ease: EASE }}>
          <RouteSearch />
        </motion.div>

        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-muted"
        >
          {m.hero.trust.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-primary" aria-hidden />
              {t}
            </li>
          ))}
        </motion.ul>
      </div>

      {/* Scène : l'illustration principale dans un grand cadre blanc, entourée de notifications de l'application. */}
      <div ref={stage} className="relative mx-auto mt-16 max-w-6xl px-4 [perspective:1600px] md:mt-20">
        <motion.div style={{ rotateX, scale }} className="relative origin-top">
          <div className="absolute -inset-x-6 -inset-y-4 -z-10 rounded-[56px] bg-gradient-to-b from-primary/25 via-accent/15 to-transparent blur-2xl" aria-hidden />
          <div className="rounded-[var(--radius-panel)] bg-white p-2 shadow-2xl shadow-navy/15 ring-1 ring-border md:p-3">
            <div className="overflow-hidden rounded-[32px] bg-white">
              {/* Emplacement : illustration principale (voir ILLUSTRATIONS.md, n° 1). */}
              <Illustration name="hero" eager />
            </div>
          </div>

          <Chip icon={Tag} tone="bg-primary text-white" title={c.offerTitle} body={c.offerBody} className="top-[12%] -start-2 lg:-start-10" delay={1} />
          <Chip icon={CheckCircle2} tone="bg-accent text-white" title={c.doneTitle} body={c.doneBody} className="top-[40%] -end-2 lg:-end-10" delay={1.2} />

          {/* Notification qui défile, posée sur le bas du cadre. */}
          <div className="absolute inset-x-0 -bottom-6 z-10 flex justify-center" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={toast}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.95 }}
                transition={{ duration: 0.35 }}
                className="flex items-center gap-3 rounded-full bg-navy py-2 ps-2 pe-5 text-white shadow-2xl shadow-navy/30"
              >
                <span className="grid size-9 place-items-center rounded-full bg-primary">
                  <ToastIcon className="size-4" />
                </span>
                <span className="text-sm">
                  <b>{current.title}</b> <span className="text-white/65">· {current.body}</span>
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Bandeau défilant des wilayas. */}
      <div className="relative mt-24 overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="marquee-track animate-marquee flex w-max gap-10 hover:[animation-play-state:paused]">
          {[...WILAYAS, ...WILAYAS].map((w, i) => (
            <span
              key={`${w.code}-${i}`}
              className="display flex items-baseline gap-2 text-2xl whitespace-nowrap text-navy/25 transition-colors hover:text-primary md:text-3xl"
              aria-hidden={i >= WILAYAS.length}
            >
              <span className="font-mono text-xs font-bold text-primary/60" dir="ltr">
                {w.code}
              </span>
              {place(w)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
