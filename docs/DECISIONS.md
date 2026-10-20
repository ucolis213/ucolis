# Décisions

Décisions prises en cours de route, en complément de la section « Décisions arrêtées » du PRD.
Une entrée par décision : date, contexte, choix, conséquence.

## 2026-10-17 — Lot 0

### Couleurs : le PRD prime sur la maquette
La maquette (`Maquette UCOLIS bilingue en écrans mobiles.png`) est verte ; le PRD fixe `primary = #FF6B35`.
On applique le PRD. Les couleurs vivent dans `packages/shared/src/theme.ts` (reprises par `apps/admin/src/index.css`,
la concordance est vérifiée par un test). Changer de palette se fait à cet endroit.

### Écarts volontaires avec la maquette
Non repris, car contraires au PRD : connexion Google (hors périmètre), choix Particulier/Professionnel à l'inscription
(le statut pro se demande après coup), portefeuille, recharge et commissions (paiement hors périmètre), validation de
remise par QR code (le PRD retient un code à 4 chiffres).

### Jetons de design dans shared
Le PRD place les jetons dans `apps/mobile/src/theme`. Pour que le back-office les partage sans dépendre de l'application
mobile, ils sont définis dans `packages/shared/src/theme.ts`. `apps/mobile/src/theme` les réexporte et ajoute la
typographie (Inter / Noto Sans Arabic).

### Référentiel géographique : 58 wilayas, 1 538 communes
Source : jeu de données libre `Kossa/algerian-cities` (noms FR/AR et coordonnées par commune). Ce jeu de données
connaît 69 wilayas mais n'affecte aucune commune aux wilayas 59 à 69 ; on s'en tient donc aux 58 wilayas dont les
communes sont cohérentes. Corrections appliquées : wilaya d'une commune déduite du préfixe de son code postal (sauf pour
les wilayas 49 à 58, issues de scissions), noms français des wilayas réécrits (accents, erreurs d'encodage), centre de
chaque wilaya = centre de sa commune chef-lieu, doublons supprimés, et 4 communes aux coordonnées aberrantes
(Mansourah, Deldoul, El Oueldja, Tessala) ramenées au centre de leur wilaya.
À faire : intégrer les 69 wilayas dès qu'une source fiable donne leur rattachement communal. Le fichier est versionné
(`version` dans `wilayas.json`) ; les codes de commune sont les codes postaux sur 5 chiffres.

### Refus des opérateurs MongoDB sans express-mongo-sanitize
`express-mongo-sanitize` réécrit `req.query`, qui est en lecture seule dans Express 5. Un middleware maison
(`apps/api/src/lib/sanitize.ts`) refuse en 400 toute clé commençant par `$` ou contenant un point, dans le corps, la
requête et les paramètres. La validation zod reste la première barrière.

### Variables d'environnement des services externes
Cloudinary, Brevo, Expo, Google Maps et Sentry sont facultatifs en développement et en test, obligatoires en production
(validation zod au démarrage). Les secrets de jetons doivent faire au moins 32 caractères et être distincts.

### Vite 6 pour le back-office
Vite 7 exige Node 20.19 ou plus ; le poste de développement est en 20.18. Vite 6 suffit et reste compatible Vitest 3.

### Tests du back-office
Vitest sur la logique (menu filtré par permissions, concordance du thème, client HTTP : rafraîchissement unique
partagé, fin de session). Les tests de bout en bout Playwright restent à écrire.

### Back-office en français
L'interface du staff est monolingue (français) en v1. Les contenus diffusés aux utilisateurs restent bilingues.

### Prix suggéré : arrondi des intermédiaires
`suggestPrice` arrondit les calculs intermédiaires au centime avant l'arrondi à 50 DA, pour éviter les erreurs de
virgule flottante (`200 × 0,036` donnerait `7,199999…`). L'exemple du PRD (3 250 DA) est couvert par un test.

### Langue et RTL
Langue initiale : celle enregistrée, sinon celle de l'appareil si elle est prise en charge, sinon le français.
La bascule RTL fait au plus un redémarrage par changement de langue (garde-fou contre une boucle si la bascule échoue,
par exemple dans Expo Go).

### Secret de jeton propre au staff
`STAFF_JWT_SECRET` signe les jetons du back-office, distinct des secrets utilisateur : un jeton utilisateur ne peut
jamais ouvrir une route `/api/v1/admin`. Les trois secrets doivent être différents (validation au démarrage).

### TOTP implémenté dans l'API
RFC 6238 (HMAC-SHA1, 30 s, ±1 pas) codé dans `lib/totp.ts` plutôt qu'une dépendance ; le secret est stocké chiffré
(AES-GCM, clé dérivée). L'invitation renvoie l'URL `otpauth://`, que le back-office affiche en QR code (`qrcode`).

### Session du staff dans le navigateur
Jeton d'accès (10 min) en mémoire ; jeton de rafraîchissement en `sessionStorage` (onglet uniquement) pour survivre à
un rechargement. La fenêtre d'inactivité de 30 min est appliquée par l'API (session glissante) et par l'interface
(déconnexion sans clic ni frappe). Un 401 déclenche un unique rafraîchissement partagé entre requêtes concurrentes.

### Balayages périodiques plutôt que tâches différées
Expirations, confirmation automatique, rappels, suppression des comptes après 14 jours, diffusions programmées :
des balayages BullMQ idempotents (`jobs/sweeps.ts`) relisent l'état en base, au lieu de tâches différées par objet
qu'il faudrait annuler ou replanifier à chaque changement.

### Regroupement des notifications de messages
Une seule notification « nouveau message » non lue par conversation : les suivantes la mettent à jour ; elle est
marquée lue à l'ouverture de la conversation.

### Dossier pro d'un compte déjà validé
Un professionnel validé qui modifie son dossier crée une demande en attente (`pendingApplication`) : il garde son
statut et ses données actuelles jusqu'à la décision du staff.

### Réglages édités en JSON
Le back-office édite chaque réglage en JSON, validé côté interface par le même schéma zod que l'API avant l'envoi
motivé. Suffisant pour le super-administrateur seul concerné ; des formulaires dédiés pourront suivre.

### Lecture d'une conversation par le staff
`GET /admin/conversations/:id/messages` renvoie aussi les participants (résumés publics) et le colis lié, pour que le
staff lise des noms et non des identifiants. Chaque lecture reste journalisée avec son motif d'accès.

### Rendu Markdown minimal
FAQ, CGU et confidentialité sont rendues par un interprète minimal (titres, listes, paragraphes) côté mobile et en
aperçu dans le back-office, sans dépendance. La FAQ se découpe en entrées sur les titres `## Question`.

## 2026-10-20 — Passage à Expo SDK 57

### SDK 57 au lieu de 54
Expo Go sur l'App Store ne prend en charge que le dernier SDK (57) : le projet en SDK 54 ne s'ouvrait pas sur iPhone.
Montée 54 → 55 → 56 → 57 : React Native 0.86, React 19.2.3 (back-office aligné pour qu'une seule copie de React soit
installée dans le monorepo), TypeScript 6 côté mobile. PRD mis à jour.
Conséquences : iOS 16.4 minimum depuis le SDK 56 (iPhone 7, 6s et SE de 1re génération exclus) ; `edgeToEdgeEnabled`
retiré (bord à bord obligatoire) ; `"types": ["jest"]` déclaré dans le tsconfig mobile (TypeScript 6 n'inclut plus les
`@types` automatiquement) ; `pnpm-lock.yaml` régénéré (les résolutions héritées gardaient des pairs en version 55).
Le SDK 58 est sorti le 15 octobre 2026 ; Expo Go pour le SDK 58 arrivera « dans quelques semaines » : il faudra alors
passer au SDK 58 ou utiliser un build de développement.

### Règles React Compiler en avertissement
`eslint-config-expo` 57 active `react-hooks/set-state-in-effect`, `react-hooks/refs` et `react-hooks/purity`, qui
signalent 13 emplacements existants (formulaires d'édition, MapPicker, PromptModal, States, socket, suivi). Ils sont
rétrogradés en avertissements dans `apps/mobile/eslint.config.js` ; leur correction fera l'objet d'un lot dédié, testé
sur appareil.

### Installation sous Windows
Avec `node-linker=hoisted`, une installation partielle (`pnpm add`, `expo install --fix`) échoue en EPERM pendant
qu'Expo s'exécute depuis `node_modules`. On écrit les versions attendues (`expo install --check`) dans `package.json`,
puis on réinstalle à partir d'un `node_modules` vide.
