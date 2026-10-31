import { Check, Globe, Menu, X } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react';
import { useState } from 'react';
import { Logo } from '../components/Logo';
import { EASE } from '../components/Reveal';
import { LOCALE_NAMES, SITE_LOCALES, useI18n } from '../i18n';

function LanguageMenu() {
  const { m, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-navy transition hover:bg-neutral-soft"
        aria-label={m.nav.language}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe className="size-4" aria-hidden />
        <span className="uppercase">{locale}</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            {/* Voile transparent : un clic en dehors referme le menu. */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
            <motion.ul
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="absolute end-0 top-full z-20 mt-3 w-44 rounded-2xl bg-white p-1.5 shadow-2xl shadow-navy/15 ring-1 ring-border"
            >
              {SITE_LOCALES.map((l) => (
                <li key={l}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={l === locale}
                    lang={l}
                    onClick={() => {
                      setLocale(l);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-primary-soft ${
                      l === locale ? 'text-primary-dark' : 'text-navy'
                    } ${l === 'ar' ? "font-['Cairo']" : ''}`}
                  >
                    {LOCALE_NAMES[l]}
                    {l === locale && <Check className="size-4" aria-hidden />}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Navbar() {
  const { m } = useI18n();
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
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <motion.nav
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
        className={`relative mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full py-2 ps-4 pe-2 transition-all duration-500 ${
          scrolled || open ? 'bg-white/85 shadow-xl shadow-navy/[0.06] ring-1 ring-border backdrop-blur-xl' : 'bg-transparent'
        }`}
      >
        <a href="#top" aria-label="UCOLIS" className="shrink-0">
          <Logo />
        </a>

        <ul className="hidden items-center lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition hover:bg-neutral-soft hover:text-navy">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1">
          <LanguageMenu />
          <a
            href="#download"
            className="hidden h-11 items-center rounded-full bg-navy px-5 text-sm font-bold text-white transition hover:bg-primary sm:inline-flex"
          >
            {m.nav.download}
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="grid size-11 place-items-center rounded-full bg-navy text-white lg:hidden"
            aria-label={open ? m.nav.close : m.nav.menu}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* Barre de progression de lecture, au bas de la pilule. */}
        <motion.span
          className={`absolute inset-x-6 bottom-0 h-[2px] origin-[0%] rounded-full bg-gradient-to-r from-primary to-accent transition-opacity rtl:origin-[100%] ${scrolled ? 'opacity-100' : 'opacity-0'}`}
          style={{ scaleX: progress }}
          aria-hidden
        />
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="mx-auto mt-2 max-w-6xl rounded-[28px] bg-white p-3 shadow-2xl shadow-navy/15 ring-1 ring-border lg:hidden"
          >
            {links.map((l, i) => (
              <motion.a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="display block rounded-2xl px-4 py-3 text-2xl text-navy hover:bg-primary-soft"
              >
                {l.label}
              </motion.a>
            ))}
            <a
              href="#download"
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-2xl bg-primary px-4 py-4 text-center font-bold text-white"
            >
              {m.nav.download}
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
