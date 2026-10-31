import { Mail, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { DEFAULT_SETTINGS } from '@ucolis/shared';
import { Illustration } from '../components/Illustration';
import { EASE, Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { interpolate, useI18n } from '../i18n';

const SUPPORT_EMAIL = DEFAULT_SETTINGS.support.email;

export function Faq() {
  const { m } = useI18n();
  const [group, setGroup] = useState(0);
  const [open, setOpen] = useState<number | null>(0);
  const items = m.faq.groups[group]!.items;

  return (
    <section id="faq" className="px-4 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.4fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading kicker={m.faq.kicker} title={m.faq.title} subtitle={m.faq.subtitle} align="start" />
          <Reveal className="-mt-4 space-y-6">
            <div className="flex flex-wrap gap-2" role="tablist">
              {m.faq.groups.map((g, i) => (
                <button
                  key={g.title}
                  type="button"
                  role="tab"
                  aria-selected={group === i}
                  onClick={() => {
                    setGroup(i);
                    setOpen(0);
                  }}
                  className={`relative rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${
                    group === i ? 'text-white' : 'bg-white text-navy ring-1 ring-border hover:ring-primary/40'
                  }`}
                >
                  {group === i && <motion.span layoutId="faq-group" className="absolute inset-0 rounded-full bg-navy" />}
                  <span className="relative">{g.title}</span>
                </button>
              ))}
            </div>
            <div className="hidden w-full max-w-[16rem] rounded-[var(--radius-sheet)] bg-white p-3 ring-1 ring-border lg:block">
              {/* Emplacement : personnage du support (ILLUSTRATIONS.md, n° 18). */}
              <Illustration name="faq" />
            </div>
          </Reveal>
        </div>

        <div>
          <AnimatePresence mode="wait">
            <motion.ul
              key={group}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              {items.map((item, i) => {
                const isOpen = open === i;
                return (
                  <li
                    key={i}
                    className={`rounded-[var(--radius-card)] bg-white ring-1 transition-shadow duration-300 ${isOpen ? 'shadow-xl shadow-primary/10 ring-primary/30' : 'ring-border'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 p-6 text-start text-lg font-bold text-navy"
                    >
                      {item.q}
                      <motion.span
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${isOpen ? 'bg-primary text-white' : 'bg-neutral-soft text-navy'}`}
                      >
                        <Plus className="size-4" />
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <p className="px-6 pb-6 leading-relaxed text-muted">{item.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </motion.ul>
          </AnimatePresence>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-6 flex items-center gap-3 rounded-[var(--radius-card)] bg-primary-soft p-5 text-sm font-semibold text-primary-dark transition hover:bg-primary hover:text-white"
          >
            <Mail className="size-5 shrink-0" aria-hidden />
            {interpolate(m.faq.more, { email: SUPPORT_EMAIL })}
          </a>
        </div>
      </div>
    </section>
  );
}
