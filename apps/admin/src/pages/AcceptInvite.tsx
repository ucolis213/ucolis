// Invitation du staff (72 h) : mot de passe et double authentification obligatoire avant le premier accès.

import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { TOTP_LENGTH } from '@ucolis/shared';
import { api, errorText } from '../api/client';
import { Button, CodeInput, ErrorBox, Input, Loading } from '../components/ui';

interface InviteInfo {
  email: string;
  firstName: string;
  secret: string;
  otpauthUrl: string;
}

export function AcceptInvite() {
  const { token = '' } = useParams();
  // Chaque appel régénère le secret : une seule lecture, sans relance automatique.
  const info = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get<InviteInfo>(`/auth/invite/${token}`),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (info.data) void QRCode.toDataURL(info.data.otpauthUrl, { margin: 1, width: 220 }).then(setQr);
  }, [info.data]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get('password') !== form.get('passwordConfirm')) return setError('Les mots de passe ne correspondent pas.');
    setPending(true);
    setError(null);
    try {
      await api.post('/auth/accept-invite', { token, password: form.get('password'), totp: form.get('totp') });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-card bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-bold">Rejoindre le back-office</h1>
        {info.isPending ? (
          <Loading />
        ) : info.error ? (
          <ErrorBox error={info.error} />
        ) : done ? (
          <p className="text-sm">
            Compte activé. <Link to="/login" className="font-semibold text-primary-dark underline">Se connecter</Link>
          </p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <p className="text-sm text-muted">
              Bonjour {info.data.firstName}, choisissez votre mot de passe puis scannez ce code avec votre application d’authentification
              (Google Authenticator, Aegis…).
            </p>
            {qr && <img src={qr} alt="Code QR de double authentification" className="mx-auto h-[220px] w-[220px]" />}
            <p className="break-all rounded bg-background p-2 text-center font-mono text-xs">{info.data.secret}</p>
            <Input label="Email" value={info.data.email} readOnly />
            <Input label="Mot de passe" name="password" type="password" autoComplete="new-password" minLength={8} required hint="8 caractères minimum, avec lettres et chiffres." />
            <Input label="Confirmation" name="passwordConfirm" type="password" autoComplete="new-password" required />
            <CodeInput label={`Code à ${TOTP_LENGTH} chiffres`} name="totp" length={TOTP_LENGTH} required />
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" loading={pending} className="w-full">
              Activer mon compte
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
