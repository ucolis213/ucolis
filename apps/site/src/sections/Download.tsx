import { Apple, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { Illustration } from '../components/Illustration';
import { Reveal } from '../components/Reveal';
import { useI18n } from '../i18n';

function StoreBadge({ icon: Icon, store }: { icon: typeof Apple; store: string }) {
  const { m } = useI18n();
  return (
    <motion.span
      whileHover={{ y: -3 }}
      className="flex items-center gap-3 rounded-2xl bg-navy px-5 py-3 text-white shadow-xl shadow-navy/20"
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
      <div className="relative mx-auto max-w-6xl">
        {/* Cadre dégradé : la bordure colorée entoure un grand panneau clair, où l'illustration se fond. */}
        <div className="rounded-[44px] bg-gradient-to-br from-primary via-accent to-warning p-[3px] shadow-2xl shadow-primary/20">
          <div className="relative grid items-center gap-6 overflow-hidden rounded-[41px] bg-white p-8 md:p-14 lg:grid-cols-[1.3fr_1fr]">
            <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_10%,transparent_60%)]" aria-hidden />
            <div className="absolute -end-24 -bottom-24 size-96 rounded-full bg-accent/20 blur-3xl" aria-hidden />

            <Reveal className="relative text-center lg:text-start">
              <h2 className="display text-[clamp(2.4rem,5.5vw,4.5rem)] leading-[1] text-balance text-navy">{m.download.title}</h2>
              <p className="mt-5 text-lg text-muted">{m.download.subtitle}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <StoreBadge icon={Play} store={m.download.googlePlay} />
                <StoreBadge icon={Apple} store={m.download.appStore} />
              </div>
              <p className="mt-4 text-sm text-subtle">{m.download.note}</p>
            </Reveal>

            {/* La main sort par le bas du panneau : l'image touche le bord, sans ligne de coupe visible. */}
            <Reveal delay={0.15} className="relative mx-auto -mb-8 w-full max-w-[18rem] self-end md:-mb-14">
              {/* Emplacement : téléphone avec l'application (ILLUSTRATIONS.md, n° 19). */}
              <Illustration name="download" />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
