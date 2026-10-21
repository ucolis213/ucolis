// Consommation Cloudinary du mois : crédits utilisés et détail (stockage, bande passante, transformations).
// Orange à partir de 80 %, rouge à partir de 95 % : au-delà du quota, envois et affichage des images peuvent être bloqués.

import type { StorageUsageDto } from '@ucolis/shared';
import { useAdminQuery } from '../api/hooks';
import { dateTime } from '../format';
import { Card, QueryState } from './ui';

export const WARN_PERCENT = 80;
export const DANGER_PERCENT = 95;

export function bytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} Go`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} Mo`;
  return `${Math.round(n / 1e3)} Ko`;
}

const credits = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export function usageLevel(percent: number | null): 'ok' | 'warn' | 'danger' {
  if (percent === null) return 'ok';
  if (percent >= DANGER_PERCENT) return 'danger';
  return percent >= WARN_PERCENT ? 'warn' : 'ok';
}

const BAR = { ok: 'bg-accent', warn: 'bg-warning', danger: 'bg-danger' } as const;

export function StorageUsageCard() {
  const query = useAdminQuery<{ usage: StorageUsageDto | null }>(['storage-usage'], '/storage-usage');
  return (
    <Card title="Images (Cloudinary)">
      <QueryState query={query}>
        {({ usage }) => {
          if (!usage) return <p className="text-sm text-muted">Consommation indisponible : Cloudinary ne répond pas ou les clés sont absentes.</p>;
          const { credits: c } = usage;
          const level = usageLevel(c.percent);
          return (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold text-navy">
                    {credits(c.used)}
                    {c.limit !== null && <span className="text-base font-normal text-muted"> / {credits(c.limit)} crédits</span>}
                  </span>
                  <span className="text-sm text-muted">
                    Plan {usage.plan || '-'}
                    {c.percent !== null && ` · ${Math.round(c.percent)} %`}
                  </span>
                </div>
                {c.percent !== null && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={Math.round(c.percent)} aria-valuemin={0} aria-valuemax={100}>
                    <div className={`h-full ${BAR[level]}`} style={{ width: `${Math.min(100, c.percent)}%` }} />
                  </div>
                )}
                {level !== 'ok' && (
                  <p className={`mt-2 text-sm ${level === 'danger' ? 'text-danger' : 'text-warning'}`}>
                    {level === 'danger'
                      ? 'Quota presque atteint : au-delà, Cloudinary peut bloquer l’envoi et l’affichage des images jusqu’au mois prochain.'
                      : 'Plus de 80 % du quota mensuel utilisé.'}
                  </p>
                )}
              </div>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <Metric label="Stockage" value={bytes(usage.storage.bytes)} sub={`${credits(usage.storage.credits)} crédits · ${usage.objects.toLocaleString('fr-FR')} fichiers`} />
                <Metric label="Bande passante (mois)" value={bytes(usage.bandwidth.bytes)} sub={`${credits(usage.bandwidth.credits)} crédits`} />
                <Metric label="Transformations (mois)" value={usage.transformations.count.toLocaleString('fr-FR')} sub={`${credits(usage.transformations.credits)} crédits`} />
              </dl>
              <p className="text-xs text-muted">
                1 crédit = 1 Go stocké, 1 Go servi ou 1 000 transformations. Mis à jour par Cloudinary {usage.updatedAt ? `le ${dateTime(usage.updatedAt)}` : 'régulièrement'} ; relu au plus toutes les 15 min.
              </p>
            </div>
          );
        }}
      </QueryState>
    </Card>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-navy">{value}</dd>
      <dd className="text-xs text-muted">{sub}</dd>
    </div>
  );
}
