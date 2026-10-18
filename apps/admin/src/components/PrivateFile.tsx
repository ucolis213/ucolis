// Fichier privé (preuve de livraison, photo de litige) : URL signée de 5 min demandée au clic, accès journalisé.

import { useState } from 'react';
import type { FileRef } from '@ucolis/shared';
import { api, errorText, qs } from '../api/client';

export function PrivateFileButton({ file, label = 'Ouvrir' }: { file: FileRef; label?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function open() {
    // Ouverture synchrone pour éviter le bloqueur de fenêtres, puis redirection vers l'URL signée.
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    setPending(true);
    setError(null);
    try {
      const { url } = await api.get<{ url: string }>(`/files${qs({ publicId: file.publicId, kind: file.kind })}`);
      if (win) win.location.href = url;
      else setError('Autorisez les fenêtres pop-up pour ouvrir le fichier.');
    } catch (err) {
      win?.close();
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }
  return (
    <span>
      <button className="text-primary-dark underline disabled:opacity-60" onClick={open} disabled={pending}>
        {label}
      </button>
      {error && <span className="ms-2 text-xs text-danger">{error}</span>}
    </span>
  );
}
