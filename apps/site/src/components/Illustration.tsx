import { ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n';
import { ILLUSTRATIONS, type IllustrationName } from '../illustrations';

/**
 * Image d'illustration ; si le fichier n'est pas encore généré, un emplacement réservé affiche son nom.
 * Les PNG détourés ont un halo blanc : ils se posent toujours sur un fond clair.
 */
export function Illustration({
  name,
  alt = '',
  className = '',
  eager = false,
}: {
  name: IllustrationName;
  alt?: string;
  className?: string;
  eager?: boolean;
}) {
  const { m } = useI18n();
  const [missing, setMissing] = useState(false);
  const { file, ratio } = ILLUSTRATIONS[name];

  if (missing) {
    return (
      <div
        style={{ aspectRatio: ratio }}
        className={`@container flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-primary/30 bg-primary-soft/60 p-4 text-center ${className}`}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        <ImageIcon className="size-8 text-primary/60" aria-hidden />
        {/* Dans un petit emplacement (avatar, vignette), seule l'icône reste ; le nom figure dans le title. */}
        <span className="font-mono text-xs font-semibold break-all text-primary-dark @max-[150px]:hidden" dir="ltr" title={file}>
          {file}
        </span>
        <span className="text-xs text-muted @max-[150px]:hidden">{m.illustration.missing}</span>
      </div>
    );
  }

  return (
    <img
      src={`/illustrations/${file}`}
      alt={alt}
      style={{ aspectRatio: ratio }}
      className={`h-auto w-full object-contain ${className}`}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setMissing(true)}
    />
  );
}
