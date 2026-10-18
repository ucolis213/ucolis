// Réglages de l'application (super-administrateur). Chaque clé est éditée en JSON, validée par le même
// schéma que l'API avant envoi, et chaque modification est motivée et journalisée.

import { useState } from 'react';
import { APP_SETTING_KEYS, APP_SETTING_SCHEMAS, type AppSettingKey, type AppSettings } from '@ucolis/shared';
import { api } from '../api/client';
import { useAction, useAdminQuery } from '../api/hooks';
import { Button, Card, PageHeader, QueryState, ReasonDialog } from '../components/ui';

const LABELS: Record<AppSettingKey, { title: string; hint: string }> = {
  pricing: { title: 'Barème du prix conseillé', hint: 'Tarifs par km et par kg, minimum, majorations (urgent, fragile).' },
  limits: { title: 'Plafonds', hint: 'Annonces et trajets actifs par type de compte, contre-offres par offre.' },
  autoConfirmHours: { title: 'Confirmation automatique (heures)', hint: 'Délai après la déclaration de livraison.' },
  parcelExpiryDays: { title: 'Expiration des annonces (jours)', hint: 'Sans transporteur retenu.' },
  reviewWindowDays: { title: 'Fenêtre des avis (jours)', hint: 'Après la livraison.' },
  requireCarrierVerification: { title: 'Vérification transporteur obligatoire', hint: 'true : seuls les transporteurs vérifiés peuvent faire une offre ou publier un trajet.' },
  minAppVersion: { title: 'Version minimale de l’application', hint: 'Les versions plus anciennes affichent l’écran de mise à jour.' },
  maintenance: { title: 'Mode maintenance', hint: 'Message bilingue affiché à l’ouverture de l’application.' },
  support: { title: 'Contact du support', hint: 'Email et WhatsApp affichés dans l’aide.' },
  termsVersion: { title: 'Version des CGU', hint: 'Mise à jour automatiquement à la publication des CGU.' },
};

export function Settings() {
  const query = useAdminQuery<AppSettings>(['settings'], '/settings');
  return (
    <div>
      <PageHeader title="Réglages">
        <p className="text-sm text-muted">Les changements s’appliquent immédiatement à l’API et à l’application (configuration publique).</p>
      </PageHeader>
      <QueryState query={query}>
        {(settings) => (
          <div className="grid gap-4 lg:grid-cols-2">
            {APP_SETTING_KEYS.map((k) => (
              <SettingEditor key={`${k}-${JSON.stringify(settings[k])}`} settingKey={k} value={settings[k]} />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

function SettingEditor({ settingKey, value }: { settingKey: AppSettingKey; value: unknown }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<unknown>(null);
  const save = useAction((reason: string) => api.put(`/settings/${settingKey}`, { value: parsed, reason }), [['settings']]);
  const dirty = text !== JSON.stringify(value, null, 2);

  function check() {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return setError('JSON invalide.');
    }
    const result = APP_SETTING_SCHEMAS[settingKey].safeParse(json);
    if (!result.success) return setError(result.error.issues.map((i) => `${i.path.join('.') || 'valeur'} : ${i.message}`).join(' ; '));
    setError(null);
    setParsed(result.data);
  }

  return (
    <Card title={LABELS[settingKey].title}>
      <p className="mb-2 text-xs text-muted">{LABELS[settingKey].hint}</p>
      <textarea
        aria-label={LABELS[settingKey].title}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        spellCheck={false}
        rows={Math.min(14, text.split('\n').length + 1)}
        className="block w-full rounded-lg border border-border p-3 font-mono text-xs outline-none focus:border-primary"
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={check} disabled={!dirty}>
          Enregistrer
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setText(JSON.stringify(value, null, 2))}>
            Annuler
          </Button>
        )}
      </div>
      <ReasonDialog open={parsed !== null} title={`Modifier « ${LABELS[settingKey].title} »`} onClose={() => setParsed(null)} onConfirm={save.mutateAsync} />
    </Card>
  );
}
