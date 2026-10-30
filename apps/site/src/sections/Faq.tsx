import { Mail, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { DEFAULT_SETTINGS } from '@ucolis/shared';
import { Illustration } from '../components/Illustration';
import { Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { interpolate, useI18n } from '../i18n';

const SUPPORT_EMAIL = DEFAULT_SETTINGS.support.email;

export function Faq() {
  const { m } = useI18n();
  const [group, setGroup] = useState(0);
  const [open, setOpen] = useState<number | null>(0);
  const items = m.faq.groups[group]!.items;

  return (
    <section id="faq" className="bg-white px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.faq.kicker} title={m.faq.title} subtitle={m.faq.subtitle} />
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.6fr]">
          <Reveal className="space-y-6">
            <div className="mx-auto w-full max-w-xs">
              {/* Emplacement : personnage du support (ILLUSTRATIONS.md, n° 18). */}
              <Illustration name="faq" />
            </div>
            <div className="flex flex-wrap gap-2 lg:flex-col" role="tablist">
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
                  className={`relative rounded-2xl px-5 py-3 text-start text-sm font-bold transition-colors ${
                    group === i ? 'text-white' : 'bg-background text-navy hover:bg-primary-soft'
                  }`}
                >
                  {group === i && <motion.span layoutId="faq-group" className="absolute inset-0 rounded-2xl bg-primary" />}
                  <span className="relative">{g.title}</span>
                </button>
              ))}
            </div>
          </Reveal>

          <div>
            <AnimatePresence mode="wait">
              <motion.ul
                key={group}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-3"
              >
                {items.map((item, i) => {
                  const isOpen = open === i;
                  return (
                    <li key={item.q} className={`rounded-[var(--radius-card)] ring-1 transition-colors ${isOpen ? 'bg-primary-soft ring-primary/30' : 'bg-background ring-border'}`}>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-4 p-5 text-start font-bold text-navy"
                      >
                        {item.q}
                        <motion.span
                          animate={{ rotate: isOpen ? 45 : 0 }}
                          className={`grid size-8 shrink-0 place-items-center rounded-full ${isOpen ? 'bg-primary text-white' : 'bg-white text-primary'}`}
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
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <p className="px-5 pb-5 leading-relaxed text-muted">{item.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </li>
                  );
                })}
              </motion.ul>
            </AnimatePresence>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted">
              <Mail className="size-4 text-primary" aria-hidden />
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold hover:text-primary">
                {interpolate(m.faq.more, { email: SUPPORT_EMAIL })}
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
