import { Apple, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { Illustration } from '../components/Illustration';
import { Reveal } from '../components/Reveal';
import { useI18n } from '../i18n';

function StoreBadge({ icon: Icon, store }: { icon: typeof Apple; store: string }) {
  const { m } = useI18n();
  return (
    <motion.span
      whileHover={{ y: -3, scale: 1.03 }}
      className="flex items-center gap-3 rounded-2xl bg-navy px-5 py-3 text-white shadow-xl"
      aria-disabled
    >
      <Icon className="size-7" aria-hidden />
      <span className="leading-tight">
        <span className="block text-[11px] text-white/60">{m.download.soon}</span>
        <span className="block text-lg font-bold">{store}</span>
      </span>
    </motion.span>
  );
}

export function Download() {
  const { m } = useI18n();
  return (
    <section id="download" className="px-4 py-20 md:py-28">
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[40px] bg-gradient-to-br from-primary via-primary to-accent p-8 md:p-14 lg:grid-cols-[1.3fr_1fr]">
        {/* Halos et colis décoratifs qui flottent. */}
        <div className="absolute -top-24 -start-24 size-80 rounded-full bg-white/20 blur-3xl" aria-hidden />
        {[
          'top-10 end-1/3 size-10 rotate-12',
          'bottom-12 start-1/2 size-14 -rotate-6',
          'top-1/2 start-8 size-8 rotate-45',
        ].map((c, i) => (
          <span
            key={c}
            className={`animate-float absolute rounded-lg bg-white/15 ring-1 ring-white/30 backdrop-blur ${c}`}
            style={{ animationDelay: `${i * 1.2}s` }}
            aria-hidden
          />
        ))}

        <Reveal className="relative text-center lg:text-start">
          <h2 className="text-3xl font-extrabold tracking-tight text-balance text-white md:text-5xl">{m.download.title}</h2>
          <p className="mt-4 text-lg text-white/80">{m.download.subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <StoreBadge icon={Play} store={m.download.googlePlay} />
            <StoreBadge icon={Apple} store={m.download.appStore} />
          </div>
          <p className="mt-4 text-sm text-white/70">{m.download.note}</p>
        </Reveal>

        <Reveal delay={0.15} className="relative mx-auto w-full max-w-xs">
          {/* Emplacement : téléphone avec l'application (ILLUSTRATIONS.md, n° 19). */}
          <Illustration name="download" className="drop-shadow-2xl" />
        </Reveal>
      </div>
    </section>
  );
}
