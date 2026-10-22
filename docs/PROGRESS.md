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
`pnpm turbo run lint typecheck test` : 12 tâches sur 12 au vert (shared 90 tests ; API 172, couverture ≈ 94 % ;
admin 9 ; mobile 31).

## Journal du 22 octobre 2026 : messagerie

- Correctif : aperçu « Offre acceptée à {{price}} » dans la liste des conversations. Le dernier message garde ses
  paramètres ; les conversations plus anciennes les relisent sur le message système.
- Correctif : badge des messages non lus resté affiché après la déconnexion.
- Suppression d'une conversation pour soi seul : glisser la ligne (droite → gauche, inversé en arabe) ou appui long,
  avec confirmation (`DELETE /conversations/:id`). Elle revient au message suivant.

À tester sur téléphone : glissement en FR et en AR, défilement vertical de la liste qui ne doit pas ouvrir de ligne.

## Journal du 22 octobre 2026 : commission et portefeuille (F19)

### Code
- `shared/commission.ts` : grille (50 DA + 15 / 12 / 10 / 8 %), ventilation, réglage `commission` (désactivé par
  défaut : service gratuit), schémas et DTO du portefeuille, traductions FR/AR (espace `wallet`).
- API, module `wallet` : Wallet, WalletTransaction, TopUpRequest. Commission figée sur le colis à l'acceptation,
  prélevée dans la transaction de livraison, remboursée si le staff sort le colis de delivered. Bonus de 1 000 DA,
  blocage sous le seuil, recharges avec preuve validées par le staff, ajustements motivés.
- Back-office : page Portefeuilles (`wallet.manage`), réglage commission documenté, commission sur la fiche colis,
  commissions encaissées et recharges en attente au tableau de bord.
- Mobile : ventilation des gains (saisie d'offre, détail d'offre, fiche colis) avec la grille en fenêtre ;
  Mon portefeuille et Recharger mon compte depuis le profil ; alerte et envoi désactivé sous le seuil.

### Avant d'activer la commission
1. Réglages → commission : remplacer les coordonnées de virement d'exemple (`topUp`).
2. Diffusion aux transporteurs avec la date d'entrée en vigueur.
3. Réglages → commission : `enabled: true` et `effectiveFrom` à cette date.
4. Donner `wallet.manage` au modérateur chargé des recharges.

### À tester sur téléphone
- Ventilation sur la saisie d'une offre (prix tapé et prix demandé) et icône d'information, en FR et en AR (RTL).
- Mon portefeuille : solde, historique, recharge avec photo et PDF ; alerte de solde insuffisant.

## Journal du 21 octobre 2026

### Code
- Publication rapide d'un colis, mode par défaut : trajet, titre, description, prix, photos facultatives
  (`app/parcel/new/quick.tsx`). « Ajouter plus de détails » ouvre l'assistant complet avec le même brouillon ; retour
  possible depuis l'étape Trajet. Voir `DECISIONS.md`.
- Photos facultatives (0 à 5) dans les deux modes.
- API : `mode` dans `POST /parcels` ; poids, dimensions, volume et date à `null` pour une annonce rapide ; filtres,
  alertes, compatibilité des trajets et back-office adaptés.
- Sélecteur de trajet extrait dans `RoutePicker`, publication commune dans `usePublishParcel`.
- Libellés « Envoyer un colis » et « Nouvelle annonce » ; police arabe IBM Plex Sans Arabic.
- Choix des adresses : « Ma position actuelle » et « Choisir sur la carte » deviennent deux icônes en fin de chaque
  champ (Départ, Arrivée), au lieu de deux lignes sous les champs.
- Accueil : dernières annonces de toutes les wilayas ; « Tout voir » ouvre la liste sans filtre.
- Notification « Nouveau colis près de vous » aux transporteurs proches du départ : position envoyée à l'ouverture
  de l'application (repli sur la commune du profil après 24 h), rayon et limite de push réglables (`nearbyParcels`).
- Correctif : plantage de la messagerie et des notifications (« undefined cannot be used as a constructor ») :
  dates relatives sans `Intl.RelativeTimeFormat`, absent de Hermes.
- Correctif : vérification validée par le staff sans effet avant reconnexion. Le profil est rechargé à chaque
  notification de la catégorie Compte et au retour de l'application au premier plan.
- Messagerie : la photo choisie reste en aperçu, retirable, et part avec le bouton d'envoi (avec le texte saisi) ;
  un toucher sur une photo de la discussion l'ouvre en plein écran, avec les autres photos à feuilleter.
- Correctif back-office : images des conversations « introuvables ». Elles sont publiques et s'affichent désormais
  en vignette (clic : plein format). Photos de litige et preuves de livraison, publiques elles aussi, sont signées
  avec leur vrai type de stockage (`type=upload`) au lieu de `authenticated`.
- Back-office : consommation Cloudinary du mois sur le tableau de bord (alerte à 80 % et 95 %).
- Ménage automatique des anciennes images (`purge-old-media`, réglage `mediaRetention`) : photos d'annonces
  terminées depuis 90 jours, images de messages de plus de 180 jours. Voir `DECISIONS.md`.
- Sélecteur de date en calendrier mensuel avec choix de l'année (expiration du permis et de l'assurance, date du
  colis, trajets, offres, filtres).
- Correctif : puces de filtres actifs étirées sur toute la hauteur de l'écran Annonces (`flexGrow: 0`).
- Correctif : une modification quittée sans enregistrer s'ouvrait à la place d'une nouvelle annonce (état persisté).
  Elle est désormais abandonnée à l'ouverture d'une nouvelle annonce, au redémarrage et à la déconnexion.

### À tester sur téléphone
- Publication rapide complète, avec et sans photo ; passage au mode complet puis retour.
- Modification d'une annonce rapide ; reprise d'un brouillon après fermeture de l'application.
- Colis proches : compte transporteur sur un téléphone (autorisation de localisation acceptée), colis publié depuis
  un autre compte près de sa position ; vérifier le push et la distance affichée.
- Messagerie : liste des conversations et envoi d'un message ; calendrier en français et en arabe.

### Contrôles
`turbo run lint typecheck test` : 12 tâches sur 12 au vert (shared 81 tests ; API 158 ; admin 9 ; mobile 27). Sous
charge, MongoDB en mémoire peut dépasser son délai de démarrage de 10 s : relancer avec `--concurrency=1`.

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
