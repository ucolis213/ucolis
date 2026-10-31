import { EyeOff, Flag, Gavel, IdCard, KeyRound, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { Illustration } from '../components/Illustration';
import { Reveal, Stagger, staggerItem } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { useI18n } from '../i18n';

const ICONS = [IdCard, Star, KeyRound, Gavel, EyeOff, Flag];

export function Trust() {
  const { m } = useI18n();
  return (
    <section className="px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.trust.kicker} title={m.trust.title} subtitle={m.trust.subtitle} />
        <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
          <Reveal className="relative flex flex-col justify-center overflow-hidden rounded-[var(--radius-panel)] bg-white px-8 py-16 ring-1 ring-border">
            <div className="absolute inset-x-10 top-10 bottom-16 rounded-full bg-accent/20 blur-3xl" aria-hidden />
            {/* Emplacement : bouclier de confiance (ILLUSTRATIONS.md, n° 11). */}
            <Illustration name="trust" className="animate-float relative mx-auto max-w-sm" />
            {/* Badges de l'application posés sur l'illustration. */}
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="absolute top-8 start-8 rounded-full bg-accent px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-accent/30"
            >
              ✓ {m.trust.items[0]!.title}
            </motion.span>
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.7, type: 'spring' }}
              className="absolute end-8 bottom-8 flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-navy shadow-xl ring-1 ring-border"
            >
              {[0, 1, 2, 3, 4].map((s) => (
                <Star key={s} className="size-3.5 fill-warning text-warning" aria-hidden />
              ))}
              <span className="ms-1">{m.trust.items[1]!.title}</span>
            </motion.span>
          </Reveal>

          <Stagger className="grid gap-4 sm:grid-cols-2">
            {m.trust.items.map((item, i) => {
              const Icon = ICONS[i]!;
              return (
                <motion.div
                  key={i}
                  variants={staggerItem}
                  className="group rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-border transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:ring-primary/30"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-navy text-white transition-colors duration-300 group-hover:bg-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-navy">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
                </motion.div>
              );
            })}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
