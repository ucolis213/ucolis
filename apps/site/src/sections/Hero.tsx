import { ArrowRight, BadgeCheck, CheckCircle2, Calculator, MapPin, Sparkles, Star, Tag } from 'lucide-react';
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react';
import { useEffect, useState, type ComponentType } from 'react';
import { WILAYAS } from '@ucolis/shared';
import { Illustration } from '../components/Illustration';
import { EASE } from '../components/Reveal';
import { useI18n } from '../i18n';

function FloatingCard({
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
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.7, ease: EASE }}
      className={`absolute z-10 ${className}`}
    >
      <div className="animate-float flex items-center gap-3 rounded-2xl bg-white/90 p-3 pe-5 shadow-xl shadow-navy/10 ring-1 ring-border backdrop-blur" style={{ animationDelay: `${delay}s` }}>
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
  const { scrollY } = useScroll();
  const blobY = useTransform(scrollY, [0, 600], [0, 120]);
  const artY = useTransform(scrollY, [0, 600], [0, -40]);
  const c = m.hero.cards;

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
    <section id="top" className="relative overflow-hidden pt-32 pb-10 md:pt-40">
      {/* Fond : grille légère et halos de couleur qui glissent au défilement. */}
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden />
      <motion.div style={{ y: blobY }} className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-24 start-[-10%] size-[28rem] rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute top-40 end-[-8%] size-[26rem] rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute bottom-0 start-1/3 size-72 rounded-full bg-warning/15 blur-3xl" />
      </motion.div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-[1.05fr_1fr]">
        <div className="text-center lg:text-start">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-primary-dark shadow-sm ring-1 ring-border"
          >
            <Sparkles className="size-4 text-warning" aria-hidden />
            {m.hero.badge}
          </motion.span>

          <h1 className="mt-6 text-4xl leading-[1.1] font-extrabold tracking-tight text-balance text-navy sm:text-5xl lg:text-6xl">
            {words.map((w, i) => (
              <motion.span
                key={`${i}-${w}`}
                initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.15 + i * 0.15, duration: 0.8, ease: EASE }}
                className={`inline ${i === 1 ? 'text-gradient' : ''}`}
              >
                {w}{' '}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="mx-auto mt-6 max-w-xl text-lg text-pretty text-muted lg:mx-0"
          >
            {m.hero.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.7 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
          >
            <a
              href="#download"
              className="group flex items-center gap-2 rounded-2xl bg-primary px-7 py-4 font-bold text-white shadow-xl shadow-primary/30 transition hover:-translate-y-0.5 hover:bg-primary-dark"
            >
              {m.hero.ctaPrimary}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
            </a>
            <a
              href="#pricing"
              className="flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-bold text-navy shadow-sm ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary/40"
            >
              <Calculator className="size-5 text-primary" />
              {m.hero.ctaSecondary}
            </a>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted lg:justify-start"
          >
            {m.hero.trust.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <BadgeCheck className="size-4 text-accent" aria-hidden />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div style={{ y: artY }} className="relative mx-auto w-full max-w-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.9, ease: EASE }}
            className="relative"
          >
            <div className="absolute inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-primary to-accent opacity-20 blur-2xl" aria-hidden />
            {/* Emplacement : illustration principale (voir ILLUSTRATIONS.md, n° 1). */}
            <Illustration name="hero" eager className="drop-shadow-2xl" />
          </motion.div>

          <FloatingCard icon={Tag} tone="bg-primary-soft text-primary" title={c.offerTitle} body={c.offerBody} className="-top-4 start-0 sm:-start-6" delay={0.9} />
          <FloatingCard icon={CheckCircle2} tone="bg-accent-soft text-accent-dark" title={c.doneTitle} body={c.doneBody} className="end-0 bottom-16 sm:-end-6" delay={1.1} />

          <div className="absolute inset-x-0 -bottom-6 z-20 flex justify-center" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={toast}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.95 }}
                transition={{ duration: 0.35 }}
                className="flex items-center gap-3 rounded-full bg-navy py-2 ps-2 pe-5 text-white shadow-2xl"
              >
                <span className="grid size-8 place-items-center rounded-full bg-primary">
                  <ToastIcon className="size-4" />
                </span>
                <span className="text-sm">
                  <b>{current.title}</b> <span className="text-white/70">· {current.body}</span>
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Bandeau défilant des wilayas. */}
      <div className="relative mt-20 overflow-hidden border-y border-border bg-white/60 py-4 backdrop-blur [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="marquee-track animate-marquee flex w-max gap-3 hover:[animation-play-state:paused]">
          {[...WILAYAS, ...WILAYAS].map((w, i) => (
            <span
              key={`${w.code}-${i}`}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-navy shadow-sm ring-1 ring-border"
              aria-hidden={i >= WILAYAS.length}
            >
              <span className="font-mono text-xs text-primary" dir="ltr">
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
