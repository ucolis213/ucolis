import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ApiError, api, errorText } from '../api/client';
import { DEV_PREVIEW_SESSION, useSession, type StaffSession } from '../auth/session';
import { TOTP_LENGTH } from '@ucolis/shared';
import { Button, CodeInput, Input } from '../components/ui';

export function Login() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [needTotp, setNeedTotp] = useState(false);
  const [pending, setPending] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const totp = String(form.get('totp') ?? '').trim();
      const session = await api.post<StaffSession>('/auth/login', {
        email: form.get('email'),
        password: form.get('password'),
        ...(totp ? { totp } : {}),
      });
      setSession(session);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOTP_REQUIRED') setNeedTotp(true);
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-card bg-surface p-8 shadow-sm">
        <div className="text-center">
          <div className="text-2xl font-bold">
            U<span className="text-primary">COLIS</span>
          </div>
          <p className="mt-1 text-sm text-muted">Back-office du staff</p>
        </div>
        <Input label="Email" name="email" type="email" autoComplete="username" required />
        <Input label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
        <CodeInput
          label="Code de double authentification"
          name="totp"
          length={TOTP_LENGTH}
          required={needTotp}
          hint={`${TOTP_LENGTH} chiffres affichés par votre application d’authentification.`}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" loading={pending} className="w-full py-2.5">
          Se connecter
        </Button>
        {import.meta.env.DEV && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSession(DEV_PREVIEW_SESSION);
              navigate('/');
            }}
          >
            Aperçu de l’interface (développement)
          </Button>
        )}
      </form>
    </div>
  );
}
