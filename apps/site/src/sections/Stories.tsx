import { Quote } from 'lucide-react';
import { motion } from 'motion/react';
import { Illustration } from '../components/Illustration';
import { Stagger, staggerItem } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { useI18n } from '../i18n';
import type { IllustrationName } from '../illustrations';

const PORTRAITS: IllustrationName[] = ['personaAmina', 'personaKarim', 'personaShop', 'personaFleet'];

export function Stories() {
  const { m } = useI18n();
  return (
    <section className="px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.stories.kicker} title={m.stories.title} subtitle={m.stories.subtitle} />
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {m.stories.items.map((s, i) => (
            <motion.figure
              key={i}
              variants={staggerItem}
              className={`group relative flex flex-col overflow-hidden rounded-[var(--radius-sheet)] bg-white ring-1 ring-border transition duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-navy/10 ${
                i % 2 ? 'lg:translate-y-10 lg:hover:translate-y-8' : ''
              }`}
            >
              {/* Emplacement : portrait du profil type (ILLUSTRATIONS.md, n° 14 à 17), fond plein. */}
              <div className="overflow-hidden">
                <Illustration name={PORTRAITS[i]!} className="transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="relative flex flex-1 flex-col p-6">
                <span className="absolute -top-6 end-5 grid size-12 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
                  <Quote className="size-5 rtl:-scale-x-100" aria-hidden />
                </span>
                <blockquote className="flex-1 text-lg leading-snug font-semibold text-navy">« {s.quote} »</blockquote>
                <figcaption className="mt-5 border-t border-border pt-4">
                  <p className="font-bold text-navy">{s.name}</p>
                  <p className="text-sm text-muted">{s.role}</p>
                </figcaption>
              </div>
            </motion.figure>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
