import { Clock, KeyRound, Map, MapPinned } from 'lucide-react';
import { motion } from 'motion/react';
import { DELIVERY_CODE_LENGTH, WILAYAS } from '@ucolis/shared';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Stagger, staggerItem } from '../components/Reveal';
import { useI18n } from '../i18n';

const COMMUNES = WILAYAS.reduce((n, w) => n + w.communes.length, 0);

export function Stats() {
  const { m, number } = useI18n();
  const items = [
    { icon: Map, value: WILAYAS.length, label: m.stats.wilayas },
    { icon: MapPinned, value: COMMUNES, label: m.stats.communes },
    { icon: Clock, value: 3, prefix: '< ', label: m.stats.minutes },
    { icon: KeyRound, value: DELIVERY_CODE_LENGTH, label: m.stats.code },
  ];

  return (
    <section className="px-4 py-16">
      <Stagger className="relative mx-auto grid max-w-6xl grid-cols-2 gap-4 overflow-hidden rounded-[var(--radius-sheet)] bg-navy p-6 md:grid-cols-4 md:p-10">
        <div className="absolute -top-20 end-10 size-64 rounded-full bg-primary/40 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 start-10 size-64 rounded-full bg-accent/30 blur-3xl" aria-hidden />
        {items.map(({ icon: Icon, value, prefix, label }) => (
          <motion.div key={label} variants={staggerItem} className="relative text-center">
            <Icon className="mx-auto mb-3 size-7 text-accent" aria-hidden />
            <div className="text-4xl font-extrabold text-white md:text-5xl" dir="ltr">
              {prefix}
              <AnimatedNumber value={value} format={number} />
            </div>
            <div className="mt-1 text-sm font-medium text-white/70">{label}</div>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
