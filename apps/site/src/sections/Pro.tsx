import { ArrowRight, BadgeCheck, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Illustration } from '../components/Illustration';
import { Reveal } from '../components/Reveal';
import { useI18n } from '../i18n';

export function Pro() {
  const { m } = useI18n();
  return (
    <section className="px-4 py-20 md:py-28">
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-[36px] bg-gradient-to-br from-navy via-[#13265a] to-primary-dark p-6 md:p-12 lg:grid-cols-2">
        <div className="bg-grid absolute inset-0 opacity-20 invert" aria-hidden />
        <div className="absolute -end-24 -top-24 size-80 rounded-full bg-accent/30 blur-3xl" aria-hidden />

        <Reveal className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-accent-soft ring-1 ring-white/20">
            <BadgeCheck className="size-4" aria-hidden />
            {m.pro.kicker}
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-white md:text-4xl">{m.pro.title}</h2>
          <p className="mt-4 text-white/70">{m.pro.body}</p>
          <ul className="mt-6 space-y-3">
            {m.pro.perks.map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-start gap-3 text-white"
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent">
                  <Check className="size-4" strokeWidth={3} />
                </span>
                {p}
              </motion.li>
            ))}
          </ul>
          <a
            href="#download"
            className="group mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-bold text-navy transition hover:-translate-y-0.5"
          >
            {m.pro.cta}
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
          </a>
        </Reveal>

        <Reveal delay={0.15} className="relative">
          <motion.div whileHover={{ rotate: -1.5, scale: 1.02 }} className="rounded-[var(--radius-sheet)] bg-white/95 p-4 shadow-2xl">
            {/* Emplacement : boutique en ligne et ses colis (ILLUSTRATIONS.md, n° 13). */}
            <Illustration name="pro" />
          </motion.div>
          <span className="absolute -bottom-3 start-6 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-xl">
            <BadgeCheck className="size-4" aria-hidden />
            {m.pro.badge}
          </span>
        </Reveal>
      </div>
    </section>
  );
}
