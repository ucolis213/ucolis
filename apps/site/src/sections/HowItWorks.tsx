import { Package, Truck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Illustration } from '../components/Illustration';
import { EASE } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';
import { useI18n } from '../i18n';
import type { IllustrationName } from '../illustrations';

type Side = 'sender' | 'carrier';

const ART: Record<Side, IllustrationName[]> = {
  sender: ['senderPublish', 'senderOffers', 'senderTrack', 'senderHandover'],
  carrier: ['carrierProfile', 'carrierTrip', 'carrierOffer', 'carrierDeliver'],
};

export function HowItWorks() {
  const { m } = useI18n();
  const [side, setSide] = useState<Side>('sender');
  const steps = m.how[side];
  const tabs: { id: Side; label: string; icon: typeof Package }[] = [
    { id: 'sender', label: m.how.tabSender, icon: Package },
    { id: 'carrier', label: m.how.tabCarrier, icon: Truck },
  ];

  return (
    <section id="how" className="px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.how.kicker} title={m.how.title} subtitle={m.how.subtitle} />

        <div className="mb-12 flex justify-center" role="tablist">
          <div className="flex rounded-full bg-white p-1.5 shadow-sm ring-1 ring-border">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={side === id}
                onClick={() => setSide(id)}
                className={`relative flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-colors sm:px-7 ${
                  side === id ? 'text-white' : 'text-muted hover:text-navy'
                }`}
              >
                {side === id && (
                  <motion.span
                    layoutId="how-tab"
                    className="absolute inset-0 rounded-full bg-primary shadow-lg shadow-primary/30"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative size-4" />
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.ol
            key={side}
            initial="hidden"
            animate="show"
            exit="exit"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } }, exit: {} }}
            className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-4"
          >
            {/* Fil qui relie les étapes sur grand écran. */}
            <motion.span
              aria-hidden
              variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 1.2, ease: EASE } }, exit: { opacity: 0 } }}
              className="absolute inset-x-[12%] top-[28%] hidden h-0.5 origin-[0%] bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 lg:block rtl:origin-[100%]"
            />
            {steps.map((step, i) => (
              <motion.li
                key={step.title}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
                  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
                }}
                className="group relative rounded-[var(--radius-card)] bg-white p-5 shadow-sm ring-1 ring-border transition hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10"
              >
                <div className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-soft to-accent-soft">
                  {/* Emplacement : illustration de l'étape (ILLUSTRATIONS.md, n° 2 à 9). */}
                  <Illustration name={ART[side][i]!} className="transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute top-3 start-3 grid size-9 place-items-center rounded-full bg-white font-extrabold text-primary shadow-md">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-navy">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </motion.li>
            ))}
          </motion.ol>
        </AnimatePresence>
      </div>
    </section>
  );
}
