import { Quote } from 'lucide-react';
import { motion } from 'motion/react';
import { Illustration } from '../components/Illustration';
import { Stagger, staggerItem } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { useI18n } from '../i18n';
import type { IllustrationName } from '../illustrations';

const AVATARS: IllustrationName[] = ['personaAmina', 'personaKarim', 'personaShop', 'personaFleet'];
const RINGS = ['ring-primary', 'ring-accent', 'ring-warning', 'ring-navy'];

export function Stories() {
  const { m } = useI18n();
  return (
    <section className="px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.stories.kicker} title={m.stories.title} subtitle={m.stories.subtitle} />
        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {m.stories.items.map((s, i) => (
            <motion.figure
              key={s.name}
              variants={staggerItem}
              whileHover={{ y: -8, rotate: i % 2 ? 1 : -1 }}
              className="relative flex flex-col rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-border"
            >
              <Quote className="absolute top-5 end-5 size-8 text-primary/15 rtl:-scale-x-100" aria-hidden />
              {/* Emplacement : avatar du profil type (ILLUSTRATIONS.md, n° 14 à 17). */}
              <div className={`size-20 overflow-hidden rounded-full ring-4 ring-offset-2 ${RINGS[i]}`}>
                <Illustration name={AVATARS[i]!} className="rounded-full object-cover" />
              </div>
              <blockquote className="mt-5 flex-1 text-navy">« {s.quote} »</blockquote>
              <figcaption className="mt-5 border-t border-border pt-4">
                <p className="font-bold text-navy">{s.name}</p>
                <p className="text-sm text-muted">{s.role}</p>
              </figcaption>
            </motion.figure>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
