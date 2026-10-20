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

## Journal du 20 octobre 2026

### Services externes mis en place
| Service | État |
|---|---|
| MongoDB Atlas (cluster M0 `ucolis`, Paris) | Connecté ; replica set présent (transactions OK) |
| Redis Cloud (base gratuite `ucolis`, Europe) | Connecté ; politique d'éviction `noeviction` (exigée par BullMQ) |
| Cloudinary (cloud `tyhfhnji`) | Envois public et privé (authenticated) testés |
| Brevo | Domaine `ucolis.com` authentifié (code, DKIM, DMARC chez OVH), expéditeur `UCOLIS <no-reply@ucolis.com>` vérifié, envoi testé |
| Expo Go sur iPhone | Application lancée en SDK 57 |
| Google Maps, Sentry, compte Apple Developer | Pas encore |

Les clés sont dans `apps/api/.env` et `apps/mobile/.env` (jamais dans git).

### Code
- Emails sur le domaine `ucolis.com` (expéditeur, support).
- Passage d'Expo SDK 54 à 57 (via 55 et 56) : React Native 0.86, React 19.2.3, TypeScript 6 côté mobile,
  iOS 16.4 minimum. Voir `DECISIONS.md`.
- Visionneuse plein écran des photos d'un colis (balayage, compteur, zoom par pincement sur iOS).
- Heures affichées sur 24 h (mobile et back-office).
- Changement de langue FR → AR : rechargement par `DevSettings.reload()` en développement (erreur
  `Cannot find native module 'ExpoAsset'` dans Expo Go).
- Choix des adresses façon Yassir (recherche Départ/Arrivée, « Ma position actuelle », récents, carte à repère
  fixe) et géocodage gratuit OpenStreetMap (Photon, Nominatim) dans l'API. Voir `DECISIONS.md`.

### À tester sur téléphone
- Changement de langue FR → AR (plus d'erreur `ExpoAsset`, passage de droite à gauche).
- Étape « Trajet » de la publication : recherche, récents, « Ma position », carte à repère fixe.

### En cours
- Connexion au back-office : créer le super-administrateur (`seed:superadmin` dans `apps/api`), ajouter le secret
  TOTP dans l'app Mots de passe de l'iPhone, se connecter sur http://localhost:5173.

### Sur un autre ordinateur
1. `git pull origin main`.
2. Node.js 20.19.4 au moins (22 conseillé).
3. Supprimer tous les `node_modules`, puis `npx pnpm@9.15.0 install` (si EPERM : désactiver le temps réel de
   l'antivirus pendant l'installation).
4. Copier `apps/api/.env` à l'identique, par un moyen sûr : `DELIVERY_CODE_KEY` chiffre le secret TOTP du staff
   et les codes de remise. Dans `apps/mobile/.env`, mettre l'IP locale de cet ordinateur.
5. MongoDB Atlas → Network Access : ajouter l'IP de cet ordinateur.
6. Lancer l'API (`apps/api` : `npx pnpm@9.15.0 dev`), puis Expo (`apps/mobile` : `npx expo start --lan -c`).

### Contrôles
`turbo run lint typecheck test` : 12 tâches sur 12 au vert (shared 77 tests ; API 149, couverture ≈ 94 % ;
admin 9 ; mobile 17).
