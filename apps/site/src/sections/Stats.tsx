import { motion } from 'motion/react';
import { DELIVERY_CODE_LENGTH, WILAYAS } from '@ucolis/shared';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Stagger, staggerItem } from '../components/Reveal';
import { useI18n } from '../i18n';

const COMMUNES = WILAYAS.reduce((n, w) => n + w.communes.length, 0);

export function Stats() {
  const { m, number, rtl } = useI18n();
  const items = [
    { id: 'wilayas', value: WILAYAS.length, label: m.stats.wilayas },
    { id: 'communes', value: COMMUNES, label: m.stats.communes },
    { id: 'minutes', value: 3, lessThan: true, label: m.stats.minutes },
    { id: 'code', value: DELIVERY_CODE_LENGTH, label: m.stats.code },
  ];

  return (
    <section className="px-4 py-16 md:py-20">
      <Stagger className="mx-auto grid max-w-6xl grid-cols-2 gap-y-10 md:grid-cols-4">
        {items.map(({ id, value, lessThan, label }, i) => (
          // Clé fixe : un changement de langue met le libellé à jour sans recréer la carte ni rejouer son apparition.
          <motion.div
            key={id}
            variants={staggerItem}
            className={`px-4 text-center md:px-6 ${i > 0 ? 'md:border-s md:border-border' : ''} ${i % 2 ? 'max-md:border-s max-md:border-border' : ''}`}
          >
            <div className="display text-5xl text-navy md:text-6xl" dir="ltr">
              {/* « < 3 » se lit de droite à gauche en arabe : le symbole passe après le chiffre et s'inverse. */}
              {lessThan && !rtl && <span className="text-primary">{'<'} </span>}
              <AnimatedNumber value={value} format={number} />
              {lessThan && rtl && <span className="text-primary"> {'>'}</span>}
            </div>
            <div className="mt-2 text-sm font-semibold text-muted">{label}</div>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
