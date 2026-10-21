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

## 2026-10-20 — Sélecteur d'adresse façon VTC

### Parcours de choix des adresses
Sur le modèle de Yassir : un écran de recherche avec les champs Départ et Arrivée reliés, « Ma position actuelle »,
adresses récentes et « Choisir sur la carte » ; sur la carte, le repère est fixe au centre et l'utilisateur fait
glisser la carte dessous (adresse résolue quand la carte s'arrête, choix impossible tant que la carte est trop
dézoomée). Les adresses récentes (6 au plus) restent sur l'appareil et sont effacées à la déconnexion. La wilaya, la
commune et le champ de précisions restent sur l'étape, conformément au PRD.

### Géocodage gratuit par OpenStreetMap
Choix d'un service gratuit plutôt que Google (carte bancaire obligatoire). Mesures du 20 octobre 2026 :
Photon (photon.komoot.io) trouve les lieux connus (Ardis, Hôpital Mustapha Pacha, Gare de l'Agha) mais répond en 8 à
10 s et n'indexe pas les noms arabes ; Nominatim répond en moins d'une seconde, en français et en arabe, mais sa
politique d'usage interdit la recherche pendant la frappe et impose 1 requête par seconde au plus. D'où :
- recherche : communes de shared/geo affichées tout de suite côté mobile, lieux et rues de Photon ajoutés à leur
  arrivée (cache Redis 7 jours) ; recherche en arabe servie par le référentiel seul ;
- adresse d'un point : Nominatim (cache Redis 7 jours, une requête par seconde et par processus) ;
- panne ou absence de résultat : repli sur shared/geo, réponse non mise en cache.
Commune et wilaya viennent toujours du référentiel. `GOOGLE_MAPS_API_KEY` devient facultative en production ; si elle
est fournie, Google remplace OpenStreetMap sans changement côté mobile. `PHOTON_URL` et `NOMINATIM_URL` permettent
d'héberger nos propres instances.
À faire avant le lancement : héberger Photon (extrait Algérie) ou passer à Google Places avec plafonds de quota, la
lenteur du Photon public n'étant pas acceptable en production ; à plusieurs instances de l'API, la limite Nominatim
devra être partagée (Redis) ou l'instance auto-hébergée.

## 2026-10-21 — Publication rapide d'un colis

### Deux modes de publication
À la demande du produit, « Envoyer un colis » ouvre une publication rapide : adresses de départ et d'arrivée, titre,
description facultative, prix demandé, photos facultatives. « Ajouter plus de détails » bascule vers l'assistant
complet en 4 étapes avec le même brouillon, et l'étape Trajet propose le retour au mode rapide. Le corps de
`POST /parcels` porte `mode: 'quick' | 'full'` ; sans `mode`, il est traité comme une publication complète.
La déclaration des objets interdits reste obligatoire dans les deux modes (règle de sécurité du PRD).

### Photos facultatives dans les deux modes
0 à 5 photos, en mode rapide comme en mode complet (le PRD exigeait au moins une photo). Le message
`validation.photosCount` devient « 5 photos au maximum ».

### Champs non précisés d'une annonce rapide
- `weightKg`, `dimensionsCm`, `volumeM3` et `desiredDate` valent `null` (« Non précisé », « Date flexible ») plutôt
  qu'une valeur inventée ; une annonce sans poids est reconnue comme rapide.
- `vehicleTypes` reçoit tous les types (tout véhicule convient), `category` et `paymentArrangement` valent `other`
  (le mobile affiche « Non précisé » pour le règlement et masque catégorie et véhicules).
- Prix suggéré : barème de F6 avec poids et volume nuls, donc fonction de la seule distance.
- Expiration : sans date souhaitée, fin de la fenêtre de publication (création + 60 jours).
- Filtres et alertes : une annonce sans date passe tout filtre de dates ; un poids maximal écarte en revanche les
  annonces sans poids. Compatibilité avec un trajet : poids, volume et date non précisés ne limitent pas.
- Modification : une annonce rapide se modifie en mode rapide, ou se complète par l'assistant (PATCH de tous les
  champs). Une annonce complète ne repasse pas en mode rapide.
- Brouillon mobile persistant en version 1 : un brouillon antérieur est repris dans l'assistant complet.

### Libellé « Envoyer un colis »
On publie une annonce, pas un colis. Le bouton d'accueil devient « Envoyer un colis » (« أرسل طردًا »), le titre de
l'écran « Nouvelle annonce » (« إعلان جديد »), le choix de l'onglet Publier « Un colis à envoyer », et l'accueil
« Décrivez votre colis… » ; le bouton final reste « Publier l'annonce ».

### Police arabe : IBM Plex Sans Arabic
IBM Plex Sans Arabic remplace Noto Sans Arabic, jugée trop neutre : plus soignée, très lisible en petite taille
(prix, adresses, badges), dans le même esprit qu'Inter. Elle a les quatre graisses utilisées (400, 500, 600, 700),
contrairement à Tajawal et Almarai, écartées pour cette raison.

### Accueil : dernières annonces de toutes les wilayas
Le PRD prévoyait les dernières annonces de la wilaya de l'utilisateur, et « Tout voir » ajoutait le filtre de départ
correspondant aux filtres existants. Au lancement, le volume est faible : filtré sur une wilaya, l'accueil serait
souvent vide, et les transporteurs sur de longs trajets s'intéressent aussi aux wilayas voisines. L'accueil montre donc
les 5 dernières annonces, toutes wilayas confondues, et « Tout voir » remet les filtres à zéro (tri par date de
publication). Quand le volume le justifiera, une section « Près de chez vous » pourra s'ajouter.

### Notification des transporteurs proches d'un nouveau colis
- Destinataires : comptes transporteur ou « les deux », actifs, hors expéditeur, comptes bloqués dans un sens ou dans
  l'autre, et transporteurs déjà prévenus par la correspondance d'un trajet.
- Position : l'application envoie la position du transporteur (`PUT /me/position`) à l'ouverture, au retour au
  premier plan puis toutes les 15 min tant qu'elle est ouverte, avec l'autorisation « pendant l'utilisation »
  seulement (demandée une fois). Pas de suivi app fermée hors livraison : moins de batterie, pas d'autorisation
  « toujours » à justifier auprès d'Apple et Google pour cet usage. Un transporteur d'Alger arrivé à Oran est
  repéré dès qu'il ouvre l'application.
- Repli : position de plus de 24 h ou absente, commune du profil (centre de la commune).
- Rayon et limite réglables par le staff (`nearbyParcels`) : 30 km, 5 push par transporteur sur 24 h ; au-delà,
  notification dans l'application seulement. Le message donne la distance en km plutôt qu'un nom de lieu, qui
  serait figé dans une seule langue.
- Seule la dernière position est gardée (`users.lastPosition`), jamais exposée par l'API, effacée à la suppression
  du compte. Textes d'autorisation iOS mis à jour en conséquence. À compléter : politique de confidentialité
  (contenu éditable du back-office).
- Envoi dans l'abonné `parcel.created`, comme les autres correspondances. Si le nombre de transporteurs proches
  devient grand, passer cet envoi dans un job BullMQ pour ne pas allonger la publication.

## Sélecteur de date en calendrier (21 octobre 2026)
- La liste de jours (jusqu'à 3 650 lignes pour l'expiration du permis) devient un calendrier mensuel en JavaScript
  (`DateSelect`, calcul dans `src/calendar.ts`) : flèches de mois, titre du mois qui ouvre la grille des années,
  jours hors bornes grisés. Pas de sélecteur natif : même rendu sur iOS et Android, chiffres latins en arabe,
  fonctionne dans Expo Go. Semaine affichée à partir du dimanche, premier jour ouvré en Algérie (`WEEK_START`).
- Dates relatives (« Il y a 5 min ») par clés i18n : Hermes ne fournit pas `Intl.RelativeTimeFormat`, ce qui
  faisait planter la messagerie. Au-delà de 7 jours, la date est affichée.

## Quota Cloudinary : suivi et ménage des images (21 octobre 2026)
- Tableau de bord du back-office : carte « Images (Cloudinary) » alimentée par l'Admin API `usage`
  (`GET /admin/storage-usage`, permission dashboard.view), gardée 15 min en cache. Orange à 80 %, rouge à 95 % :
  au-delà du quota du plan gratuit (25 crédits par mois), Cloudinary peut bloquer envois et affichage.
- Ménage horaire `purge-old-media`, réglable (`mediaRetention`, 30 jours minimum) : photos d'une annonce livrée,
  annulée ou expirée depuis 90 jours, images de messages envoyées depuis 180 jours. Jamais pendant un signalement
  ouvert (annonce, conversation, message) ni un litige ouvert sur le colis de la conversation.
- Gardés : photos de litige et preuves de livraison (pièces d'un éventuel recours), pièces d'identité et
  justificatifs pro (déjà supprimés à l'anonymisation du compte).
- Une annonce dupliquée partage les fichiers de l'originale : un fichier encore utilisé par une autre annonce
  n'est pas détruit. Le message reste, sans fichier ; l'application affiche « Photo expirée ».
