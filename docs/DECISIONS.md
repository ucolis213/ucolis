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

## Blocage visible dans la messagerie (21 octobre 2026)
- La conversation expose `blockedByMe` (je bloque l'autre) et `canSend` (faux si l'un des deux bloque l'autre).
  `canSend` ne dit pas qui a bloqué : la personne bloquée lit « Vous ne pouvez plus répondre dans cette
  conversation » sans apprendre qu'elle a été bloquée.
- On reste dans la discussion après un blocage. Elle passe en lecture seule, et la zone de saisie est remplacée
  par un bandeau, avec « Débloquer » pour la personne qui bloque.
- Le déblocage se fait aussi depuis le menu de la conversation et depuis le profil public, et plus seulement
  depuis la liste des bloqués (PRD F3). Sinon, l'action « Bloquer » restait proposée pour un compte déjà bloqué.
- En-tête de la discussion : photo, nom, badge « Identité vérifiée » (ou « Identité non vérifiée »), badge pro
  et note. Un toucher sur l'en-tête ou sur la photo d'un message ouvre le profil public, également accessible
  par « Voir le profil » dans le menu.

## Commission et portefeuille du transporteur (22 octobre 2026)
- Retour sur le lot 0 et sur le hors-périmètre du PRD, à la demande du propriétaire du produit : la commission
  entre dans la v1 (F19 du PRD). Le prix de la course reste réglé hors application ; seule la commission passe par
  un portefeuille prépayé du transporteur. Gratuit au lancement : `commission.enabled` vaut false par défaut et
  seul le super-administrateur l'active (Réglages), après une diffusion et avec une date `effectiveFrom`.
- Grille demandée : 50 DA + 15 % sous 1 000 DA, 12 % de 1 000 à 3 000 DA, 10 % de 3 000 à 10 000 DA, 8 % au-delà.
  Les deux tranches du milieu se chevauchaient à 3 000 DA : 3 000 DA est à 12 %. Taux unique selon la tranche du
  prix entier (pas de tranches marginales, contrairement au barème du prix conseillé) ; arrondi au dinar.
- La commission ne dépasse jamais le prix convenu (gains nets ≥ 0), même si le prix minimal d'une offre baisse.
- Commission figée sur le colis à l'acceptation : le transporteur paie ce qu'on lui a affiché, même si la grille
  change avant la livraison. Retour à la gratuité entre l'acceptation et la livraison : commission abandonnée
  (waived). Un colis sorti de delivered par le staff est remboursé.
- Prélèvement dans la transaction qui passe le colis en delivered, et non dans un abonné d'événement : un abonné
  en échec est seulement journalisé, la commission serait perdue. Le statut de la commission sur le colis
  (pending → charged → refunded) rend prélèvement et remboursement idempotents.
- Une transaction MongoDB ne voit pas un document créé après son début : le portefeuille est ouvert avant la
  transaction de livraison (`wallet.prepare`), jamais pendant.
- Portefeuille ouvert, avec le bonus de 1 000 DA, à la validation de l'identité si la commission est activée,
  sinon au premier accès d'un compte qui peut transporter (même règle que pour faire une offre). Pas de
  portefeuille pendant la gratuité : les transporteurs déjà vérifiés reçoivent leur bonus à l'activation, sans
  script de rattrapage. Un seul bonus par compte (index unique partiel).
- Blocage sous `minBalance` (0 DA) : offre, nouvelle proposition, acceptation d'une contre-offre et acceptation
  par l'expéditeur. L'expéditeur reçoit CARRIER_UNAVAILABLE, sans détail sur le solde du transporteur.
- Recharge manuelle : virement CCP ou BaridiMob, preuve en fichier privé (`topup_proof`, accès authenticated),
  validation par le staff (nouvelle permission `wallet.manage`, accordable à un modérateur), qui crédite le
  montant réellement reçu. Une seule demande en attente par transporteur. Coordonnées de virement d'exemple dans
  `DEFAULT_COMMISSION.topUp`, à remplacer dans les réglages avant l'activation.
- Pas de collection `CommissionConfig` : la configuration est une clé d'AppSetting (`commission`), comme le barème
  du prix, éditée et journalisée par le même écran.

## 22 octobre 2026 : date et heure de l'annonce

- Date souhaitée jusqu'à un an (`DESIRED_DATE_MAX_DAYS`), au lieu de 60 jours. Le calendrier propose cette durée
  par défaut partout (annonce, prise en charge d'une offre, départ d'un trajet, filtres). Une annonce sans date
  expire toujours au bout de 60 jours (`PUBLISH_WINDOW_DAYS`).
- Heure précise facultative (`desiredTime`, « HH:mm », pas de 5 minutes, sur deux roues comme le réveil de l'iPhone) en plus du créneau.
  Quand elle est donnée, l'API impose le créneau correspondant (avant 12 h matin, avant 18 h après-midi, sinon
  soir) : filtres et compatibilité des trajets restent fondés sur le créneau. Choisir un autre créneau efface
  l'heure.

## 23 octobre 2026 : négociation et prix ronds

- Tout prix saisi est un multiple de 10 DA (`PRICE_STEP_DA`, `priceSchema`, `isRoundPrice`) : prix demandé
  d'une annonce, offre, contre-offre, nouvelle proposition, forfait indicatif d'un trajet. Le tarif au kilo
  d'un trajet reste libre. Le barème (`roundTo`, `minPrice`) n'accepte que des multiples de 10, pour que le prix
  suggéré reste rond. Les annonces existantes à prix non rond devront être corrigées à leur prochaine modification.
- Cohérence de la négociation imposée par l'API : une contre-offre est strictement inférieure au prix du
  transporteur (COUNTER_PRICE_NOT_LOWER), une nouvelle proposition strictement supérieure à la contre-offre
  (REOFFER_PRICE_NOT_HIGHER). Sinon, il suffit d'accepter.
- Boutons de négociation (mobile) : confirmation avant d'accepter une contre-offre (attribution du colis) et
  avant de refuser une offre (définitif) ; « Garder mon prix » affiche le prix maintenu ; un seul geste à la fois
  (pas de double envoi) ; message facultatif joint à la contre-offre et à la nouvelle proposition ; l'expéditeur
  peut refuser une offre en contre-offre depuis son détail ; états d'attente explicites des deux côtés ; liste
  des offres mise à jour en temps réel.

## 23 octobre 2026 : passage à Expo SDK 58

- Expo Go installé sur les téléphones de test est en SDK 58 : montée 57 → 58 (React Native 0.88, React 19.3.0,
  Jest 30). Le back-office suit React 19.3.0 pour garder une seule copie de React dans le monorepo.
- `react-test-renderer` et `@react-native/jest-preset` sont déclarés explicitement en dépendances de développement
  du mobile : sinon pnpm garde d'anciennes versions remontées (19.2.3, 0.86.3) et les tests ne démarrent plus.
- En test, `expo-font` est simulé (polices tenues pour chargées) : avec RN 0.88, `expo-asset` lit le registre
  d'assets privé de react-native, que `jest-expo` 58.0.12 ne simule pas.

## 24 octobre 2026 : code de remise après une déclaration de livraison

- Le transporteur retenu peut saisir le code de remise en delivered_pending (nouvelle transition
  delivered_pending → delivered, par le transporteur, avec le code correct) : il finalise sans attendre la
  confirmation de l'expéditeur ni les 72 h. Mêmes effets que la remise avec code ; mêmes 5 essais au total.
- En delivered_pending, le transporteur retrouve aussi « Message » et « Ouvrir un litige » (le litige était déjà
  permis par la machine à états, mais aucune action ne l'affichait).
- « Saisir le code de remise » disparaît des actions quand la saisie est bloquée (`deliveryCodeLocked`).

## 24 octobre 2026 : avis, signalement d'un avis, badge des messages

- Une seule note par personne : un avis par auteur et par personne notée, tous colis confondus (auparavant un par
  colis). Sur un nouveau colis, « Noter » disparaît si l'autre partie est déjà notée, pas de relance, et l'API
  répond 409 ALREADY_REVIEWED. Contrôle applicatif (`hasRated`), sans index unique : la base peut contenir des
  doublons antérieurs.
- Double aveugle : la publication a lieu dès que les deux personnes se sont notées, même sur deux colis
  différents (sinon l'avis de l'une attendrait 14 jours une réponse devenue impossible).
- Signaler un avis (déjà prévu par l'API, F16) : drapeau sur chaque avis du profil public (sauf les siens) et
  sur les avis reçus dans « Mes avis ».
- Écran de notation : « Note globale » obligatoire et nommée, critères marqués facultatifs ; la note globale suit
  la moyenne des critères tant qu'elle n'a pas été choisie.
- Lecture d'une discussion : le badge est remis à zéro tout de suite dans la liste, et la liste n'est relue
  qu'après l'accusé de lecture du serveur (avant, elle était relue trop tôt et gardait l'ancien compteur).

## 24 octobre 2026 : couleur de marque bleue et réglable

- La couleur de marque passe de l'orange (#FF6B35) au bleu #0069D8 (le bleu principal de Cocolis, blue-500),
  jugé plus rassurant ; la nuance foncée dérivée (#0056B1) est proche de leur blue-600 (#0055AF). Les nuances
  `primaryDark` et `primarySoft` sont calculées à partir d'elle (`brandPalette`, shared/theme.ts).
- Nouveau réglage `branding.primaryColor` (super-administrateur, page Réglages avec sélecteur de couleur et
  aperçu), exposé dans la configuration publique. Refus d'une couleur trop claire pour du texte blanc
  (contraste WCAG < 4,5).
- Mobile : les styles étant figés au chargement des modules, la couleur est appliquée de façon synchrone au
  chargement de `src/theme` (SecureStore), avant tout écran. Une couleur différente reçue du serveur est
  enregistrée puis appliquée par un redémarrage unique de l'application (pas de boucle : relecture vérifiée).
  Remplacé le 25 octobre 2026 : plus de redémarrage, voir plus bas.
- Back-office : variables CSS de Tailwind redéfinies à l'exécution (src/brand.ts), dernière couleur gardée en
  localStorage ; appliquée tout de suite après l'enregistrement du réglage.
- Reste fixe : la couleur des notifications Android déclarée dans app.config.ts (prise au build).

## 24 octobre 2026 : police Cairo et flèches en arabe

- Police arabe : Cairo remplace IBM Plex Sans Arabic, partout (application mobile ; back-office pour les textes
  arabes, après Inter dans la pile de polices). Mêmes graisses 400, 500, 600 et 700.
- Flèche d'un trajet (départ → arrivée) : `routeArrow()` (src/theme) donne ← en arabe, pour qu'elle pointe vers
  l'arrivée dans le sens de lecture. Même principe pour la flèche « déplacer la photo » de la grille de photos.
- La police arabe et la flèche suivent la langue choisie (`readsRtl()` dans src/theme), pas seulement
  `I18nManager.isRTL` : la mise en page RTL n'est effective qu'après un redémarrage natif (dans Expo Go, parfois
  seulement après fermeture complète), alors que les textes arabes se lisent déjà de droite à gauche.

## 24 octobre 2026 : adresses d'un trajet saisies comme celles d'un colis

- « Proposer un trajet » : départ et arrivée se choisissent avec la même recherche que pour un colis (recherche,
  position actuelle, adresses récentes, carte), via `RouteFields` extrait de `RoutePicker`. Wilaya et commune
  sont déduites de l'adresse ; la position envoyée est celle de l'adresse choisie, et non plus le centre de la
  commune. Le départ est prérempli avec la commune du profil. Textes d'invite propres aux trajets
  (`trip.whereFrom`, `trip.whereTo`).

## 25 octobre 2026 : étapes d'un trajet saisies comme le départ et l'arrivée

- Les étapes de « Proposer un trajet » se choisissent avec la même recherche d'adresse (recherche, position
  actuelle, adresses récentes, carte) : `AddressSearch` accepte désormais une liste de champs (`fields`) et un
  titre, et sert ici sur le seul champ `stop`. Le modèle ne change pas (PRD F9 : de 0 à 5 wilayas étapes) :
  seule la wilaya de l'adresse choisie est envoyée, sans doublon ; l'adresse complète n'est qu'affichée.

## 25 octobre 2026 : couleur de marque sans redémarrage, bleu par défaut éclairci

- Le redémarrage automatique après un changement de couleur est supprimé : relancer le runtime pendant le
  démarrage fait planter Expo Go (« Cannot find native module 'ExpoAsset' », puis « "main" has not been
  registered »). La couleur reçue du serveur est enregistrée (SecureStore) et appliquée au prochain lancement.
- Bleu par défaut : #1A73E8 au lieu de #0069D8, plus clair et plus engageant (contraste avec le blanc 4,51,
  juste au-dessus du minimum de 4,5 exigé pour le texte des boutons). Nuances dérivées : #155EBE (foncée),
  #E8F1FD (douce).

## 25 octobre 2026 : aucune messagerie avant l'acceptation d'une offre

- Expéditeur et transporteur n'échangent aucun message tant qu'une offre n'est pas acceptée : la négociation
  porte uniquement sur le prix. « Poser une question » disparaît de l'annonce, et « Message » des actions d'un
  transporteur qui a une offre en cours.
- Règle dans l'API (`canMessage`, conversations/service.ts) : une conversation de colis exige une offre acceptée
  sur ce colis entre les deux ; une conversation générale (« Contacter ») exige une livraison acceptée ensemble,
  sur n'importe quel colis. Une offre acceptée puis abandonnée par le transporteur compte. Refus : 403
  MESSAGING_LOCKED, à l'ouverture comme à l'envoi (HTTP et Socket.IO).
- Les conversations ouvertes avant cette règle restent lisibles mais verrouillées : `ConversationDto.locked`, et
  l'écran de conversation explique que les messages s'ouvrent une fois l'offre acceptée.
- Les offres et contre-offres ne portent plus de message libre (champ retiré du schéma, du modèle et du DTO ;
  un message envoyé par une ancienne version de l'application est ignoré) : il aurait permis d'échanger des
  coordonnées avant l'acceptation.

## 25 octobre 2026 : véhicule, clavier et message d'incompatibilité

- Ajout d'un véhicule : seuls le type, la marque et l'immatriculation sont obligatoires. Modèle (chaîne vide),
  capacité et volume (null) sont facultatifs, dans le schéma partagé, le modèle Mongoose et les DTO ; les
  affichages omettent ce qui n'est pas précisé.
- « Faire une offre » sans véhicule compatible : l'écran indique les types demandés par le colis et les
  véhicules du transporteur, avec « Gérer mes véhicules ».
- Clavier dans les feuilles iOS (connexion, inscription, signalement, filtres) : `KeyboardAvoidingView` compare
  le clavier à sa position relative à son parent. Les écrans en feuille sont enveloppés dans `<Sheet>`
  (src/components/SheetContext.tsx) ; `Screen` y passe en `keyboardVerticalOffset` la hauteur de l'écran moins
  celle de la feuille (une feuille descend jusqu'en bas). La mesure par measureInWindow, peu fiable dans une
  feuille, est abandonnée. Tout nouvel écran présenté en feuille doit être enveloppé dans `<Sheet>`.


## 25 octobre 2026 : vérification des transporteurs conseillée, non bloquante

- `requireCarrierVerification` vaut désormais false par défaut (shared/settings.ts) et sur l'instance ; le PRD
  (« Décisions arrêtées ») est mis à jour. Un transporteur non vérifié peut faire une offre et publier un trajet.
- Mobile : plus aucun blocage local (la configuration en cache pouvait être périmée). Si le réglage est activé,
  l'API refuse avec CARRIER_NOT_VERIFIED et l'application propose alors de compléter la vérification.
- Écran « Faire une offre » : tant que le compte n'est pas vérifié, un encadré conseille la vérification (ou
  indique qu'elle est en cours d'examen) avec « Vérifier mon compte ».
- « Accepter le prix » ou « Proposer un prix » par un transporteur sans dossier (ou refusé, expiré) : un message
  l'invite à se faire vérifier, avec deux choix, « Vérifier mon compte » ou « Continuer sans vérifier »
  (`askToVerify`). Dossier en cours d'examen : pas de message, il continue directement.
- Côté expéditeur, une offre d'un transporteur non vérifié porte une mention neutre : identité pas encore
  vérifiée par UCOLIS, avis et historique pour aider au choix.
- Détail d'une annonce : la tuile « Favori » passe au cœur plein rouge quand l'annonce est en favori.

## 25 octobre 2026 : profil public remanié, « Contacter » après une offre acceptée

- Profil public : drapeau « Signaler » et menu « Plus » (Bloquer / Débloquer) dans l'en-tête ; carte de
  présentation avec « Contacter » en bouton principal ; statistiques de confiance en tuiles.
- `GET /users/:id` accepte une authentification facultative et renvoie `canContact` (même règle que
  `canMessage` : livraison acceptée entre le visiteur et ce profil). « Contacter » n'apparaît que dans ce cas.


## 26 octobre 2026 : contenus d'aide, CGU, confidentialité et À propos

- Première version de la FAQ (50 questions en 7 rubriques), des CGU (27 articles) et de la politique de
  confidentialité (13 sections), en français et en arabe, rédigées d'après le PRD et les décisions ci-dessus.
  Sources dans `apps/api/src/modules/content/defaults/<clé>.<langue>.md`, publiées par
  `pnpm --filter api seed:content` (v1). Le script ne touche jamais un contenu déjà publié : les versions
  suivantes passent par la page Contenus du back-office, qui reste la référence.
- Identité légale de l'éditeur (raison sociale, forme, capital, RC, NIF, siège) et numéro de récépissé de
  l'ANPDP laissés entre crochets dans les CGU et la politique : à compléter depuis le back-office avant la
  soumission aux stores. Âge minimal : majorité civile algérienne (19 ans). Référence légale : loi 18-07.
- FAQ par rubriques (PRD F17) : `# Rubrique` regroupe les `## Question` qui suivent ; l'écran Aide affiche le
  titre de la rubrique avant sa première question, recherche comprise. Une FAQ sans rubrique reste valide.
- À propos : présentation, mission, fonctionnement en 4 étapes, engagements, contact, liens vers les CGU et la
  confidentialité, puis les informations de version (PRD F17). Nombre de wilayas lu dans `shared/geo`.

## 29 octobre 2026 : refonte visuelle du mobile, inspirée de Yassir

- Langage visuel proche des super-applications algériennes (Yassir) : bandeau de couleur aux coins arrondis
  en haut de l'accueil et du profil, barre de recherche blanche dans le bandeau, grille de tuiles de services,
  carte d'appel bleu nuit, formes très arrondies (cartes 20, boutons 16, bandeaux 28), ombres douces.
- Palette : le bleu de marque (#1A73E8, toujours réglable) et ses variantes. Bleu nuit #0E1B3D pour le texte,
  bleu ciel #0EA5E9 en accent (succès, vérifié, suivi), fonds et gris légèrement bleutés.
- Nouveaux jetons dans `shared/theme.ts` : `accentDark`, `warningDark`, `neutralSoft` et les rayons `button`,
  `tile`, `sheet`. Les couleurs en dur du mobile passent par ces jetons.
- Champs de saisie remplis (gris doux, contour bleu au focus) ; variante de bouton `soft` ; « outline » devient
  un bouton gris doux sans contour ; onglet actif sur une pastille bleue douce ; bouton Publier en carré arrondi surélevé,
  détouré de la couleur de la barre et remonté pour que son libellé reste visible.
- Trajet d'une annonce affiché en deux lignes reliées (point au départ, carré à l'arrivée) : `RouteStops`.
- Barre d'état claire sur les écrans à bandeau (`useLightStatusBar`).

## 29 octobre 2026 : adresses sans doublon

- Détail d'une annonce : une seule ligne par adresse. L'expéditeur et le transporteur retenu voient l'adresse
  complète (qui contient déjà commune et wilaya) et les précisions ; les autres, commune et wilaya.
- Étape « Trajet » de la publication complète et de la modification : plus de sélecteurs wilaya et commune sous
  les adresses. Elles viennent de l'adresse choisie ; seules les précisions (rue, repère, étage) restent à saisir.
- Recherche d'adresse : choisir une commune ouvre la carte sur son centre pour placer l'endroit exact, au départ
  comme à l'arrivée. Fermer la carte garde la commune et passe au champ suivant.
- Carte des annonces : les départs ne sont plus regroupés par wilaya (bulle fixe au centre de la wilaya) mais
  selon le zoom (`src/mapClusters.ts`) : deux annonces se rejoignent quand elles sont plus proches que 8 % de la
  zone affichée, et se séparent en zoomant jusqu'à leurs adresses réelles. Toucher une bulle ouvre toutes ses
  annonces dans un carrousel horizontal (position « 2 / 3 », carte suivante visible au bord) ; le titre donne la
  commune partagée par tout le groupe, sinon la wilaya.
- Détail d'une annonce et récapitulatif de publication : départ et arrivée affichés par `RouteAddresses`
  (rail point / carré, titre « Départ » ou « Arrivée » au-dessus, adresse complète dessous, sur toute la
  largeur) au lieu de deux lignes titre / valeur. `KeyValue` : le titre garde sa largeur (jusqu'à la moitié de
  la ligne) et c'est la valeur qui passe à la ligne ; une valeur longue n'écrase plus le titre. La valeur prend
  toute la place restante, calée au bord : les valeurs restent alignées en colonne au bord de la carte.
- Détail d'une annonce : la description de l'expéditeur s'affiche sous un titre « Description », séparée des
  lignes titre / valeur par un trait.
- Accueil : services en grille 2 × 2 de cartes blanches (pastille d'icône colorée, titre, une ligne
  d'explication, flèche) au lieu d'une rangée de 4 petites tuiles. « Mes livraisons » prend l'icône `bag-check`.
- Accueil : les quatre services partagent la même pastille (bleu de marque sur bleu doux).
- Barre d'onglets redessinée (`src/components/TabBar.tsx`, passée à `Tabs` par `tabBar`) : pilule blanche
  flottante à ombre douce et fin contour gris clair (couleur du fond), décollée des bords et du bas. Elle est
  superposée au contenu, sans bande de fond : le contenu défile dessous. Les écrans à onglets réservent la place
  en bas (`TabBarSpaceContext`, fourni par le layout des onglets) : `Screen` l'ajoute seul quand il défile ou a
  des marges ; les listes d'Annonces et de Messages l'ajoutent à la fin de leur contenu ; le carrousel de la
  carte se pose au-dessus de la barre. Onglet actif : icône
  pleine bleue sur une pastille bleu doux et libellé bleu en gras ; onglets au repos en gris. Bouton Publier
  surélevé, détouré de blanc ; il garde ses couleurs une fois sélectionné. Toutes les icônes occupent un
  emplacement de même hauteur (le bouton Publier en déborde vers le haut) : les libellés sont sur une même
  ligne. Pastille rouge des messages non lus
  sur l'icône. Sous Android, la barre se cache pendant la saisie.
- Profil : ligne « Notifications » en tête de la section Activité, vers l'écran des notifications, avec le
  nombre de non lues en pastille rouge (compteur temps réel de la cloche). `MenuRow` accepte `badge`.
- Prix suggéré d'une annonce rapide complétée : le prix suit la suggestion tant que l'expéditeur ne l'a pas
  retouché (`priceToApply`, drapeau `priceIsSuggested` du brouillon). En passant aux détails, il est recalculé
  avec le poids et le volume. Une annonce rapide déjà publiée que l'on complète est reconnue à son prix égal à
  la suggestion sur la seule distance. Un prix saisi à la main n'est jamais écrasé.

## 29 octobre 2026 : barème du prix suggéré revu pour le pouvoir d'achat algérien

- L'ancien barème facturait 50 DA par kilo taxé quelle que soit la distance : 15 kg mais 3 m³ (600 kg taxés)
  sur 1 km donnaient 30 650 DA. Nouveau barème (PRD F6) : prise en charge 300 DA, coût kilométrique par
  tranches (3 ; 2,5 ; 2 ; 1,5 DA/km) multiplié par un facteur de taille 1 + poids taxé / 50, plafonné à 8,
  manutention dégressive (20 DA/kg jusqu'à 30 kg, 8 jusqu'à 200, 3 au-delà), +10 % si fragile, minimum
  300 DA. Le même cas donne 3 850 DA ; Alger → Oran, 5 kg : 1 500 DA (contre 3 250).
- `fragile` entre dans le calcul (mobile, API, `POST /pricing/suggest`). Réglage `pricing` : `perKg` est
  remplacé par `weightTiers`, `sizeStepKg`, `maxSizeFactor` et `fragileSurcharge`.
- Un barème déjà enregistré depuis le back-office est fusionné avec les valeurs par défaut : ses anciennes
  clés (`baseFee`, `tiers`, `minPrice`) l'emporteraient. Le réenregistrer avec les nouvelles valeurs.
- FAQ : nouvelle version des sources ; une FAQ déjà publiée se met à jour depuis la page Contenus.
- Choix de l'heure (`TimeSelect`) : roues refaites façon iOS. Chiffres en Inter à chasse fixe, taille fixe et
  hauteur de ligne égale à celle d'une ligne de la roue, dans les deux langues (Cairo décentrait les chiffres) ;
  deux-points de même hauteur ; recalage au pixel à l'arrêt ; lignes inclinées, réduites et estompées en
  s'éloignant du centre (animation sur le fil natif) ; retour haptique à chaque cran (expo-haptics).
- Nettoyage du code mort : retrait des `.gitkeep` de dossiers remplis, de `resized()` (Cloudinary), `asHref`,
  `activeTrackingParcel`, `GEO_VERSION`, `TRIP_STATUS_VALUES`, `OFFER_INITIAL_STATUS`, et de 29 clés de
  traduction jamais affichées (fr et ar). `MESSAGE_MAX_LENGTH` est désormais utilisé par le schéma d'envoi de
  message au lieu de répéter 2000.
- Recherche d'adresse : une commune choisie n'est plus transmise avant l'ouverture de la carte. Un seul lieu
  part par champ (le point placé, ou la commune si la carte est fermée sans point) : une étape de trajet
  n'apparaît plus en double (commune puis adresse exacte).

## 30 octobre 2026 : site vitrine web (`apps/site`)

- Site de présentation de l'application mobile, distinct de l'« application web publique » exclue de la v1
  (PRD, hors périmètre) : aucune connexion, aucun appel à l'API, aucune fonctionnalité de la place de marché.
  Une seule page : accueil, chiffres, comment ça marche (expéditeur / transporteur), fonctionnalités,
  simulateur de prix, suivi en direct, confiance, transporteurs (grille de commission), comptes pro, carte des
  wilayas, profils types (personas du PRD, présentés comme tels), FAQ, téléchargement.
- Pile du back-office (React 19, Vite, Tailwind 4) avec `motion` pour les animations et `lucide-react` pour
  les icônes. Animations désactivées si le système demande de réduire les animations.
- Les chiffres et calculs viennent de `shared` et ne sont jamais recopiés : `suggestPrice` pour le simulateur
  (entre les centres des wilayas, 8 km dans une même wilaya), `commissionBreakdown` et la grille par défaut,
  `WILAYAS` pour la carte et les compteurs, `DEFAULT_SETTINGS.support` pour le contact. Couleurs : jetons de
  `shared/theme`, vérifiés par test.
- Textes du site dans `apps/site/src/locales/{fr,ar}.json` (propres au site, hors `shared/i18n`), avec test
  de parité des clés. Arabe en RTL (`dir="rtl"` sur `<html>`), langue mémorisée dans le navigateur.
- Illustrations : dessins à générer (prompts et emplacements dans `apps/site/ILLUSTRATIONS.md`), déposés dans
  `apps/site/public/illustrations/`. Tant qu'un fichier manque, un cadre indique son nom. Un test vérifie que
  chaque illustration du code a son prompt.
- Les boutons des stores affichent « Bientôt sur » : aucun lien tant que l'application n'est pas publiée.
- Le site n'affiche plus la grille de commission ni le calcul des gains nets : la section transporteurs
  présente une carte d'avantages (gratuité au lancement, sans montant ni barème).
- Le site est aussi en anglais (`apps/site/src/locales/en.json`, même test de parité), choisi dans un menu à
  trois langues. L'anglais est propre au site : l'application reste FR/AR, et le site reprend pour l'anglais
  les noms de lieux et le format de prix du français.
- Positionnement du site : d'abord le transport de colis entre particuliers, les professionnels étant
  bienvenus en second (section pro présentée comme « Vous êtes une entreprise ? », profils types étiquetés
  particulier ou pro, question dédiée dans la FAQ).
- Refonte visuelle du site (branche `feat/site-redesign`) : style clair en grands panneaux arrondis, titres en
  Bricolage Grotesque (Cairo en arabe), recherche « départ → arrivée » dès l'accueil qui pré-remplit le
  simulateur (état partagé dans `src/route.tsx`), étapes « Comment ça marche » en défilement narratif, bouton de
  téléchargement fixe sur mobile. Les PNG détourés ont un halo blanc : ils restent toujours sur fond clair.

## 31 octobre 2026 : prix suggéré sous les sociétés de livraison, avertissement juridique

- Barème recalibré (mêmes formule et réglages, PRD F6) pour rester sous les tarifs des sociétés de livraison
  algériennes (relevés indicatifs 2026, non officiels : 400 à 600 DA en ville, 500 à 750 DA entre wilayas,
  1 000 à 1 400 DA vers le Grand Sud, environ 50 DA par kilo au-delà de 5 kg). Prise en charge 150 DA, coût
  kilométrique 1,2 ; 0,8 ; 0,5 ; 0,3 DA/km, manutention 10 ; 6 ; 2 DA/kg, minimum 200 DA. Petit colis :
  environ 200 DA en ville, 450 DA de Sétif à Alger, 600 DA d'Alger à Oran (contre 1 500), 950 DA d'Alger à
  Tamanrasset. Un barème déjà enregistré depuis le back-office l'emporte : le réenregistrer.
- Site : avertissement juridique en pied de page et question de FAQ « Quelle est la responsabilité de
  UCOLIS ? ». UCOLIS est un intermédiaire technique, ni transporteur, ni commissionnaire, ni dépositaire ; le
  prix, le transport, la remise et le règlement relèvent des seules parties. La carte « Litiges arbitrés »
  dit désormais que la modération examine le litige (et non qu'elle tranche). Texte à faire valider par un
  juriste et à reprendre dans les CGU de l'application.
- CGU (version du 31 octobre 2026, `apps/api/src/modules/content/defaults/terms.{fr,ar}.md`) : article 3,
  UCOLIS n'est pas non plus dépositaire des colis ; article 21 détaille l'exclusion de responsabilité (perte,
  vol, avarie, retard, nature et licéité des objets, exécution de la Course, paiements, comportement des
  Utilisateurs) et précise que badges, avis, GPS, Code de remise et examen des litiges ne valent pas garantie.
  La case à cocher de l'inscription le dit en clair (« je reconnais que UCOLIS est un intermédiaire, non
  responsable des transports convenus entre utilisateurs »). Le script de contenus n'écrase jamais des CGU
  déjà publiées : sur une base existante, publier cette version depuis la page Contenus du back-office, ce
  qui crée une nouvelle version que chaque utilisateur devra accepter.
- Site : l'avertissement juridique du pied de page est retiré (la clause engage par les CGU acceptées à
  l'inscription, pas par le site). Le pied de page renvoie vers « Conditions d'utilisation » (`#/cgu`) et
  « Politique de confidentialité » (`#/confidentialite`), affichées par le site à partir des mêmes fichiers
  Markdown que l'API (`content/defaults`, importés en `?raw`) ; en anglais, la version française s'affiche
  avec une mention. La question de FAQ sur la responsabilité de UCOLIS reste et renvoie à l'article 21.
- Backend : `pnpm --filter api migrate:pricing` (`src/modules/pricing/migration.ts`) remplace un barème
  enregistré en base, qui primerait sur le nouveau barème par défaut (la fusion des réglages se fait clé par
  clé), et journalise le changement au nom du super-administrateur. Il recalcule aussi le prix suggéré des
  annonces ouvertes ou en négociation ; le prix demandé, les offres et les annonces déjà attribuées ne changent
  pas. Sans effet sur une base déjà à jour : relançable sans risque.

## 31 octobre 2026 : application mobile en anglais

- Troisième langue de l'interface : `LOCALES = ['fr', 'ar', 'en']`, traductions dans
  `packages/shared/src/i18n/en.json` (mêmes clés, mêmes paramètres `{{…}}` : deux tests de parité). Elle sert
  aussi aux push, aux emails de code et aux erreurs de l'API ; l'utilisateur la choisit à l'accueil ou dans
  Profil > Langue, et un téléphone réglé en anglais démarre en anglais. Pas de RTL.
- Les contenus saisis au back-office (FAQ, CGU, confidentialité, message de maintenance, annonces diffusées)
  et les noms de wilayas et de communes restent en français et en arabe (`CONTENT_LOCALES`) : l'anglais reçoit
  la version française (`contentLocale()`), y compris `GET /content/:key?locale=en`. Les CGU en français font foi.
- Dates en `en-GB` (jour/mois), montants « 3 250 DA » comme en français. Textes de permission iOS en anglais
  (`apps/mobile/locales/en.json`).
