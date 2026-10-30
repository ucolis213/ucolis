import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/** Nombre qui défile de 0 à sa valeur quand il entre à l'écran. */
export function AnimatedNumber({ value, format = String }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) return setShown(value);
    const controls = animate(0, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  return <span ref={ref}>{format(shown)}</span>;
}

/** Valeur qui glisse de l'ancienne à la nouvelle à chaque changement (prix du simulateur). */
export function TweenNumber({ value, format = String }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      current.current = value;
      return setShown(value);
    }
    const controls = animate(current.current, value, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => {
        current.current = v;
        setShown(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <>{format(shown)}</>;
}
