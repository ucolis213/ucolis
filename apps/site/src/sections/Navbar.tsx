import { Globe, Menu, X } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react';
import { useState } from 'react';
import { Logo } from '../components/Logo';
import { useI18n } from '../i18n';

export function Navbar() {
  const { m, toggleLocale } = useI18n();
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  const links = [
    { href: '#how', label: m.nav.how },
    { href: '#features', label: m.nav.features },
    { href: '#pricing', label: m.nav.pricing },
    { href: '#carriers', label: m.nav.carriers },
    { href: '#faq', label: m.nav.faq },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Barre de progression de lecture. */}
      <motion.div className="absolute inset-x-0 top-0 h-1 origin-[0%] bg-gradient-to-r from-primary to-accent rtl:origin-[100%]" style={{ scaleX: progress }} />
      <motion.nav
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`mx-auto mt-3 flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-2.5 transition-all duration-300 md:px-5 ${
          scrolled ? 'mx-3 bg-white/80 shadow-lg shadow-navy/5 ring-1 ring-border backdrop-blur-xl md:mx-auto' : 'bg-transparent'
        }`}
      >
        <a href="#top" aria-label="UCOLIS">
          <Logo />
        </a>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="group relative rounded-full px-3 py-2 text-sm font-semibold text-muted transition-colors hover:text-navy"
              >
                {l.label}
                <span className="absolute inset-x-3 -bottom-0.5 h-0.5 origin-center scale-x-0 rounded-full bg-primary transition-transform group-hover:scale-x-100" />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLocale}
            className="flex items-center gap-1.5 rounded-full bg-neutral-soft px-3 py-2 text-sm font-bold text-navy transition hover:bg-primary-soft hover:text-primary-dark"
          >
            <Globe className="size-4" aria-hidden />
            {m.nav.language}
          </button>
          <a
            href="#download"
            className="hidden rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5 hover:bg-primary-dark sm:inline-block"
          >
            {m.nav.download}
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="grid size-10 place-items-center rounded-full bg-neutral-soft lg:hidden"
            aria-label={open ? m.nav.close : m.nav.menu}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="mx-3 mt-2 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-border lg:hidden"
          >
            {[...links, { href: '#download', label: m.nav.download }].map((l, i) => (
              <motion.a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="block rounded-xl px-4 py-3 font-semibold text-navy hover:bg-primary-soft"
              >
                {l.label}
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
