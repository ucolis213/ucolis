import { Package, Truck } from 'lucide-react';
import { AnimatePresence, motion, useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
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

/** Étape du récit : elle devient active quand elle passe au milieu de l'écran. */
function Step({
  index,
  title,
  body,
  active,
  onActive,
  art,
}: {
  index: number;
  title: string;
  body: string;
  active: boolean;
  onActive: () => void;
  art: IllustrationName;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' });
  useEffect(() => {
    if (inView) onActive();
  }, [inView, onActive]);

  return (
    <li ref={ref} className="relative flex gap-5 lg:min-h-[44vh] lg:items-center">
      <div className={`transition-all duration-500 lg:ps-2 ${active ? 'opacity-100' : 'lg:opacity-30'}`}>
        <span
          className={`display block text-6xl leading-none transition-colors duration-500 md:text-7xl ${active ? 'text-primary' : 'text-primary lg:text-navy/15'}`}
          dir="ltr"
        >
          0{index + 1}
        </span>
        <h3 className="display mt-4 text-3xl text-navy md:text-4xl">{title}</h3>
        <p className="mt-3 max-w-md text-lg leading-relaxed text-muted">{body}</p>
        {/* Sur mobile, chaque étape montre sa propre image. */}
        <div className="mt-6 overflow-hidden rounded-[var(--radius-sheet)] bg-white p-4 ring-1 ring-border lg:hidden">
          <Illustration name={art} className="mx-auto max-w-xs" />
        </div>
      </div>
    </li>
  );
}

export function HowItWorks() {
  const { m } = useI18n();
  const [side, setSide] = useState<Side>('sender');
  const [active, setActive] = useState(0);
  const steps = m.how[side];
  const tabs: { id: Side; label: string; icon: typeof Package }[] = [
    { id: 'sender', label: m.how.tabSender, icon: Package },
    { id: 'carrier', label: m.how.tabCarrier, icon: Truck },
  ];
  // Fonctions stables par étape : l'effet de Step ne se relance pas à chaque rendu.
  const setters = useRef([0, 1, 2, 3].map((i) => () => setActive(i))).current;

  return (
    <section id="how" className="px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={m.how.kicker} title={m.how.title} subtitle={m.how.subtitle} />

        {/* Onglets collants sur grand écran seulement : sur mobile, ils masqueraient le texte. */}
        <div className="z-20 mb-10 flex justify-center lg:sticky lg:top-24 lg:mb-4" role="tablist">
          <div className="flex rounded-full bg-white/85 p-1.5 shadow-xl shadow-navy/[0.06] ring-1 ring-border backdrop-blur-xl">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={side === id}
                onClick={() => {
                  setSide(id);
                  setActive(0);
                }}
                className={`relative flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-colors sm:px-7 ${
                  side === id ? 'text-white' : 'text-muted hover:text-navy'
                }`}
              >
                {side === id && (
                  <motion.span layoutId="how-tab" className="absolute inset-0 rounded-full bg-navy" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                )}
                <Icon className="relative size-4" />
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <ol key={side} className="space-y-14 lg:space-y-0">
            {steps.map((step, i) => (
              <Step key={i} index={i} title={step.title} body={step.body} active={active === i} onActive={setters[i]!} art={ART[side][i]!} />
            ))}
          </ol>

          {/* Grand écran : l'image reste fixe et change avec l'étape lue. */}
          <div className="hidden lg:block">
            <div className="sticky top-[calc(50vh-15rem)]">
              <div className="relative aspect-square overflow-hidden rounded-[var(--radius-panel)] bg-white shadow-2xl shadow-navy/10 ring-1 ring-border">
                <div className="bg-dots absolute inset-0 opacity-60" aria-hidden />
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={`${side}-${active}`}
                    initial={{ opacity: 0, scale: 0.92, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.04, y: -30 }}
                    transition={{ duration: 0.55, ease: EASE }}
                    className="absolute inset-8"
                  >
                    {/* Emplacement : illustration de l'étape (ILLUSTRATIONS.md, n° 2 à 9). */}
                    <Illustration name={ART[side][active]!} />
                  </motion.div>
                </AnimatePresence>
                {/* Avancement : une barre par étape. */}
                <div className="absolute inset-x-8 bottom-6 flex gap-2" aria-hidden>
                  {steps.map((_, i) => (
                    <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-soft">
                      <motion.span
                        className="block h-full rounded-full bg-primary"
                        initial={false}
                        animate={{ width: i <= active ? '100%' : '0%' }}
                        transition={{ duration: 0.5, ease: EASE }}
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
