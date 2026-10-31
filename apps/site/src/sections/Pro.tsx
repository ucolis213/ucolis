import { BadgeCheck, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { CtaLink } from '../components/CtaLink';
import { Illustration } from '../components/Illustration';
import { Reveal } from '../components/Reveal';
import { useI18n } from '../i18n';

export function Pro() {
  const { m } = useI18n();
  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 rounded-[var(--radius-panel)] bg-gradient-to-br from-primary-soft via-white to-accent-soft p-6 ring-1 ring-border md:p-12 lg:grid-cols-2">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-navy px-3.5 py-1.5 text-xs font-bold tracking-wider text-white uppercase">
            <BadgeCheck className="size-4" aria-hidden />
            {m.pro.kicker}
          </span>
          <h2 className="display mt-5 text-4xl leading-[1.05] text-balance text-navy md:text-5xl">{m.pro.title}</h2>
          <p className="mt-4 leading-relaxed text-muted">{m.pro.body}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {m.pro.perks.map((p, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-start gap-3 rounded-2xl bg-white/80 p-3 text-sm font-semibold text-navy ring-1 ring-border"
              >
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {p}
              </motion.li>
            ))}
          </ul>
          <CtaLink href="#download" variant="dark" className="mt-8">
            {m.pro.cta}
          </CtaLink>
        </Reveal>

        <Reveal delay={0.15} className="relative">
          <motion.div whileHover={{ rotate: -1.2, scale: 1.02 }} className="rounded-[var(--radius-sheet)] bg-white p-3 shadow-2xl shadow-navy/10 ring-1 ring-border">
            {/* Emplacement : boutique en ligne et ses colis (ILLUSTRATIONS.md, n° 13). */}
            <Illustration name="pro" className="rounded-3xl" />
          </motion.div>
          <span className="absolute -bottom-4 start-6 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-xl shadow-primary/30">
            <BadgeCheck className="size-4" aria-hidden />
            {m.pro.badge}
          </span>
        </Reveal>
      </div>
    </section>
  );
}
