import { Download } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useState } from 'react';
import { useI18n } from '../i18n';

/** Sur mobile, une fois l'accueil passé, un bouton de téléchargement reste à portée de pouce. */
export function MobileCta() {
  const { m } = useI18n();
  const { scrollY } = useScroll();
  const [shown, setShown] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => {
    // Masqué en bas de page, où le bloc de téléchargement est déjà visible.
    const nearEnd = y + window.innerHeight > document.body.scrollHeight - 1400;
    setShown(y > 900 && !nearEnd);
  });

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed inset-x-3 bottom-3 z-40 sm:hidden"
        >
          <a
            href="#download"
            className="flex items-center justify-center gap-2 rounded-full bg-primary py-4 font-bold text-white shadow-2xl shadow-primary/40"
          >
            <Download className="size-5" aria-hidden />
            {m.hero.ctaPrimary}
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
