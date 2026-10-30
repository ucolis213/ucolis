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
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.4fr]">
          <Reveal className="relative mx-auto w-full max-w-sm">
            <div className="absolute inset-8 -z-10 rounded-full bg-accent/30 blur-3xl" aria-hidden />
            {/* Emplacement : bouclier de confiance (ILLUSTRATIONS.md, n° 11). */}
            <Illustration name="trust" className="animate-float" />
            {/* Badges de l'application qui orbitent autour de l'illustration. */}
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="absolute top-6 -start-2 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-lg"
            >
              ✓ {m.trust.items[0]!.title}
            </motion.span>
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.7, type: 'spring' }}
              className="absolute -end-2 bottom-10 flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-navy shadow-lg ring-1 ring-border"
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
                  key={item.title}
                  variants={staggerItem}
                  whileHover={{ y: -4 }}
                  className="flex gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-sm ring-1 ring-border"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-dark">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-navy">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                  </div>
                </motion.div>
              );
            })}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
