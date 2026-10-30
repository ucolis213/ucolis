import { ArrowUp, Mail, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { DEFAULT_SETTINGS, formatPhoneDz } from '@ucolis/shared';
import { Logo } from '../components/Logo';
import { interpolate, useI18n } from '../i18n';

const { email, whatsapp } = DEFAULT_SETTINGS.support;

export function Footer() {
  const { m } = useI18n();
  const product = [
    { href: '#how', label: m.nav.how },
    { href: '#features', label: m.nav.features },
    { href: '#pricing', label: m.nav.pricing },
    { href: '#carriers', label: m.nav.carriers },
  ];

  return (
    <footer className="relative overflow-hidden bg-navy px-4 pt-16 pb-8 text-white">
      <div className="absolute -top-32 end-0 size-96 rounded-full bg-primary/20 blur-3xl" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm text-white/60">{m.footer.tagline}</p>
        </div>
        <nav aria-label={m.footer.product}>
          <h3 className="font-bold">{m.footer.product}</h3>
          <ul className="mt-4 space-y-2 text-sm text-white/60">
            {product.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="transition hover:text-white">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={m.footer.help}>
          <h3 className="font-bold">{m.footer.help}</h3>
          <ul className="mt-4 space-y-2 text-sm text-white/60">
            <li>
              <a href="#faq" className="transition hover:text-white">
                {m.nav.faq}
              </a>
            </li>
            <li>
              <a href="#download" className="transition hover:text-white">
                {m.nav.download}
              </a>
            </li>
          </ul>
        </nav>
        <div>
          <h3 className="font-bold">{m.footer.contact}</h3>
          <ul className="mt-4 space-y-2 text-sm text-white/60">
            <li>
              <a href={`mailto:${email}`} className="flex items-center gap-2 transition hover:text-white">
                <Mail className="size-4" aria-hidden />
                {email}
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${whatsapp.replace('+', '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 transition hover:text-white"
              >
                <MessageCircle className="size-4" aria-hidden />
                <span dir="ltr">{formatPhoneDz(whatsapp)}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="relative mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-white/50 sm:flex-row">
        <p>{interpolate(m.footer.rights, { year: new Date().getFullYear() })}</p>
        <p>{m.footer.made}</p>
        <motion.a
          href="#top"
          whileHover={{ y: -4 }}
          className="grid size-10 place-items-center rounded-full bg-white/10 text-white"
          aria-label={m.footer.backToTop}
        >
          <ArrowUp className="size-5" />
        </motion.a>
      </div>
    </footer>
  );
}
