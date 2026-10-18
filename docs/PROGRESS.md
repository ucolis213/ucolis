# Avancement

## Lot 0 — Fondations : terminé
Monorepo, shared, squelettes API / back-office / mobile, CI. Voir l'historique git et `docs/DECISIONS.md`.

## API (lots 1 à 10) : terminée et testée
`apps/api` : 146 tests Vitest (MongoDB en mémoire, replica set), couverture ≈ 94 %.

| Lot | Modules API | Tests |
|---|---|---|
| 1 Comptes | auth (OTP, délai progressif, refresh rotatif + rejeu), me (profil, mot de passe, email, préférences, appareils, blocage, push tokens), uploads signés | auth, me |
| 2 Colis | parcels (création, liste filtrée, détail par rôle, modification, annulation, duplication), géo (Google + repli local), profil public | parcels |
| 3 Négociation | carrier (vérification, véhicules), offers (offre, contre-offres ≤ 3, acceptation atomique en transaction) | offers |
| 4 Messagerie | Socket.IO (+ adaptateur Redis), conversations, notifications + push Expo, bus d'événements et abonnés | messaging |
| 5 Livraison | delivery (démarrage, code, déclaration, confirmation, désistement), tracking GPS, jobs BullMQ (balayages idempotents) | delivery |
| 6 Back-office | staff (TOTP, invitation, permissions, transfert), audit (ajout seul), masquage PII, utilisateurs, vérifications identité, colis, réglages, stats, seed super-admin | admin |
| 7 Confiance | avis (double aveugle), signalements (masquage auto à 3), litiges + instruction staff, conversations staff | trust |
| 8 Pro | dossier pro, examen staff, révocation, export CSV | pro |
| 9 Trajets | trips (récurrence, compatibilité, demandes), alertes regroupées, favoris | trips |
| 10 Publication | suppression de compte (grâce 14 j), contenus versionnés, diffusions, OpenAPI `/api/v1/docs`, Sentry | account, app |

## Mobile : terminé
Tous les écrans des lots 1 à 10 : assistant de publication, liste / carte / filtres, détail colis, offres et
négociation, messagerie temps réel, notifications push, livraison et suivi GPS, avis, litiges, statut pro,
vérification transporteur, véhicules, trajets, alertes, favoris, mes colis / offres / livraisons, aide (FAQ éditable),
CGU / confidentialité, à propos, suppression de compte.
Contrôles : `tsc` (après génération des routes typées par `expo start`), lint, 11 tests Jest (logique de démarrage, FAQ, composants).
Reste : tests sur appareils réels (Android bas de gamme, RTL), build EAS.

## Back-office web : terminé
Connexion avec 2FA, invitation (QR code TOTP), tableau de bord, utilisateurs (+ CSV), vérifications identité et pro
(prise en charge, pièces signées, décision motivée), colis, trajets, litiges (dossier, trace GPS, décision),
signalements, avis, conversations, diffusion, contenus Markdown, réglages, staff, audit (+ CSV).
Contrôles : `tsc`, lint, build Vite, 9 tests Vitest (menu, thème, client HTTP).
Reste : tests de bout en bout Playwright.

## État global
`pnpm turbo run lint typecheck test` : 12 tâches sur 12 au vert (shared 77 tests, couverture ≈ 99 % ; API 146 ;
admin 9 ; mobile 11).
