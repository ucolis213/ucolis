# UCOLIS

Place de marché mobile de livraison de colis en Algérie (expéditeurs ↔ transporteurs), FR/AR (RTL).

- Spécification complète : `docs/PRD.md`. Elle fait foi ; les décisions de sa section « Décisions arrêtées » ne se rediscutent pas.
- Décisions prises en cours de route : `docs/DECISIONS.md` (à compléter à chaque lot).
- Avancement par lot : `docs/PROGRESS.md`.

## Monorepo (pnpm + Turborepo)

| Chemin | Rôle |
|---|---|
| `packages/shared` | enums, erreurs, `pricing.ts`, `geo/` (wilayas.json), `stateMachines.ts`, `permissions.ts`, `notifications.ts`, `settings.ts`, `theme.ts`, `schemas/` (zod), `i18n/` (fr.json, ar.json) |
| `apps/api` | Express 5, Mongoose 8, zod. `src/modules/<domaine>/{routes,controller,service,model,schemas}.ts` |
| `apps/admin` | Back-office React 19 + Vite 6 + React Router 7 + TanStack Query + Tailwind 4 |
| `apps/mobile` | Expo SDK 58, RN 0.88, Expo Router 58 |
| `apps/site` | Site vitrine (une page, FR/AR) : React 19 + Vite 6 + Tailwind 4 + motion ; illustrations dans `ILLUSTRATIONS.md` |

`shared` est consommé en TypeScript source (pas de build) ; l'API l'embarque via tsup.

## Commandes

```
pnpm install
pnpm dev            # les quatre applications (site sur le port 5174)
pnpm test           # vitest (shared, api, admin, site) + jest (mobile)
pnpm typecheck
pnpm lint
```

Typecheck du mobile : les types des routes (`.expo/types`) sont générés au `expo start`.

## Règles

- Les règles métier vivent dans l'API (services) et dans `shared` ; jamais seulement dans l'interface.
- Machines à états : uniquement `shared/stateMachines.ts`. Une transition absente donne 409 INVALID_TRANSITION.
- Erreurs API : `{ error: { code, message, details } }`, avec des codes de `shared/errors.ts` traduits côté client (`errors:<CODE>`).
- Messages de validation zod = clés `validation.*` de l'espace `errors`.
- Aucune chaîne en dur dans le mobile : clés dans `shared/src/i18n/{fr,ar}.json` (le test de parité doit passer).
- RTL : marges `start`/`end`, jamais `left`/`right` ; icônes directionnelles via `forwardIcon()` et `backIcon()`.
- Les services n'envoient jamais de notification directement : ils émettent un événement de domaine.
- Masquage des données personnelles dans l'API, jamais dans l'interface.
- Couverture ≥ 80 % sur `shared` et sur les services de l'API.
- Identifiants en anglais, textes affichés en français et en arabe, commentaires en français.
