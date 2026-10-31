# UCOLIS — Spécification produit (PRD)

> Document de référence. Les écrans de `Maquette UCOLIS bilingue en écrans mobiles.png` sont des propositions visuelles ;
> en cas de contradiction, ce document fait foi (voir `docs/DECISIONS.md`).

## Vue d'ensemble

UCOLIS est une place de marché mobile de livraison de colis en Algérie. Un expéditeur publie un colis et des transporteurs proposent un prix. L'expéditeur en retient un, puis suit la livraison en temps réel jusqu'à la remise confirmée.

**Problème.** Envoyer un colis d'une wilaya à l'autre passe par des contacts informels ou des sociétés de transport rigides. Pendant ce temps, des milliers de trajets roulent à vide ou à moitié pleins. UCOLIS relie les deux côtés avec un prix négocié, de la confiance (identités vérifiées, statut pro validé, avis) et de la traçabilité (GPS, code de remise).

### Objectifs produit

- Publier un colis complet en moins de 3 minutes.
- Laisser le marché fixer le prix par offres, contre-offres et acceptation, avec un prix suggéré issu d'un barème unique.
- Instaurer la confiance : vérification des transporteurs et des professionnels par le staff, avis croisés, signalements et litiges modérés.
- Rendre la livraison transparente : statuts explicites, suivi GPS en direct, remise confirmée par code.
- Remplir les trajets des transporteurs : publication de trajets et alertes sur les annonces compatibles.
- Couvrir toutes les wilayas, en français et en arabe (RTL).

### Indicateurs de succès, 6 mois après le lancement

| Indicateur | Cible |
|---|---|
| Temps médian de publication d'un colis | < 3 min |
| Colis recevant au moins 1 offre sous 24 h | ≥ 60 % |
| Colis acceptés menés jusqu'à delivered | ≥ 90 % |
| Livraisons qui finissent en litige | < 2 % |
| Délai médian de traitement d'un dossier (identité ou pro) | < 24 h |
| Sessions sans plantage | ≥ 99,5 % |

### Personas

- Amina, 34 ans, Alger : envoie des cadeaux à sa famille à Oran ; veut un prix juste et savoir où est son colis.
- Karim, 41 ans, chauffeur de fourgon particulier à Sétif : fait Sétif–Alger chaque semaine ; veut remplir ses retours.
- Une boutique en ligne à Blida, compte professionnel : publie plusieurs colis par semaine vers différentes wilayas.
- Une SARL de transport à Oran avec 3 camionnettes, compte professionnel : publie ses trajets et répond aux annonces.
- Un modérateur UCOLIS : traite les dossiers, signalements et litiges depuis un ordinateur ou un téléphone, avec des droits limités à son rôle.

## Rôles, types de compte et staff

Deux populations sont séparées : les utilisateurs de la place de marché, dans l'application mobile, et le staff, dans le back-office web. Un compte staff ne publie ni ne transporte. Un utilisateur n'accède jamais au back-office.

### Utilisateurs : rôle décidé colis par colis

Un même compte peut expédier et transporter. Le choix fait à l'inscription (intent : sender, carrier ou both) oriente seulement l'interface : accueil, raccourcis, onglets mis en avant. Il se change dans le profil. Les droits réels se décident colis par colis : propriétaire du colis ou transporteur retenu.

| Rôle | Peut | Ne peut pas |
|---|---|---|
| Visiteur (non connecté) | Parcourir l'accueil, les annonces, les trajets, le détail d'un colis et un profil public | Faire une action : offre, publication, message, signalement. Une feuille « Connectez-vous » s'ouvre à la place |
| Expéditeur | Publier, modifier, annuler ses colis ; négocier le prix et accepter une offre ; échanger des messages une fois l'offre acceptée ; suivre ; confirmer la remise ; ouvrir un litige ; noter | Modifier un colis après acceptation d'une offre ; annuler une fois la livraison démarrée (il passe par un litige) |
| Transporteur | Parcourir et filtrer ; faire des offres ; publier des trajets ; démarrer et terminer une livraison ; partager sa position ; se désister avant le départ ; ouvrir un litige ; noter | Faire une offre ou publier un trajet sans identité vérifiée ; faire une offre sur son propre colis ; avoir plus d'une offre active par colis |

### Particulier ou professionnel

Tout compte naît particulier, qu'il expédie, transporte ou les deux. Le statut professionnel ne se déclare pas : il se demande avec des justificatifs, et seul un membre du staff habilité le valide. Tant qu'il n'est pas validé, le compte reste particulier, quelles que soient les informations saisies.

- Cycle du statut pro (`pro.status`) : none → pending (dossier envoyé) → approved ou rejected. Un refus porte un motif obligatoire et permet un nouveau dépôt. Un statut approved peut passer à revoked par le staff, avec un motif obligatoire.
- `accountType` vaut professional seulement si `pro.status = approved`, sinon individual. Ce champ est calculé par l'API. Aucune route client ne peut l'écrire.
- Pendant pending, le dossier est en lecture seule. Modifier la raison sociale ou le numéro de RC d'un compte validé ouvre un nouveau dossier. Le statut reste approved jusqu'à la décision.

Dossier pro demandé :

| Élément | Obligatoire | Format |
|---|---|---|
| Raison sociale ou nom commercial | Oui | Texte, 2–100 caractères |
| Forme juridique | Oui | auto_entrepreneur, artisan, eurl, sarl, spa, snc, other |
| Registre du commerce, carte d'auto-entrepreneur ou carte d'artisan | Oui | Numéro + scan (JPEG, PNG ou PDF, 10 Mo max) |
| NIF | Oui | 15 chiffres + scan |
| NIS | Non | Numéro |
| Adresse du siège | Oui | Texte + wilaya + commune |
| Logo | Non | Image carrée, 512 px minimum |

Avantages d'un compte pro validé :

- Badge « Pro vérifié » sur les cartes d'annonce, les offres, les trajets et le profil.
- Raison sociale et logo affichés à la place du nom, et fiche entreprise publique.
- Duplication de colis et publication en série.
- Export CSV de l'historique des colis.
- Jusqu'à 20 colis actifs au lieu de 5 et 10 trajets actifs au lieu de 3. Ces valeurs sont des réglages modifiables.

### Vérification d'identité du transporteur

Elle est distincte du statut pro : un particulier comme un professionnel doit la passer pour transporter. Le réglage `requireCarrierVerification` est activé par défaut. Pour faire une offre ou publier un trajet, il faut alors `carrierVerification.status = approved`.

- Pièces : carte d'identité (recto et verso), permis de conduire, carte grise, attestation d'assurance. Formats : image ou PDF. Le permis et l'assurance portent une date d'expiration.
- Cycle : not_submitted → pending → approved ou rejected. Un dossier approved passe à expired automatiquement quand une pièce datée expire. Des rappels partent 30 jours et 7 jours avant.
- Badge « Identité vérifiée » une fois validé.

### Staff : super-administrateur et modérateurs

- **Super-administrateur** (`super_admin`) : unique. Il est créé par un script au premier déploiement (`pnpm --filter api seed:superadmin`). Il a toutes les permissions et ne peut être ni désactivé ni supprimé. Il peut transférer son rôle à un modérateur actif, après confirmation par mot de passe et code 2FA.
- **Modérateurs** (`moderator`) : créés uniquement par le super-administrateur, sur invitation email. Le lien reste valable 72 h pour définir le mot de passe et la 2FA. Chacun reçoit une liste de permissions, cochées à la création et modifiables ensuite. Un modérateur n'agit jamais sur un compte staff.
- La double authentification (TOTP) est obligatoire pour tout compte staff. Chaque action d'écriture du staff est enregistrée dans le journal d'audit avec un motif.

**Permissions.** L'écran de création d'un modérateur propose trois modèles pré-cochés : « Vérificateur », « Modérateur contenu » et « Support ».

| Permission | Donne accès à |
|---|---|
| dashboard.view | Tableau de bord et statistiques agrégées |
| users.view | Liste et fiche des utilisateurs, avec email et téléphone masqués |
| users.view_pii | Email, téléphone et adresses en clair ; chaque affichage est journalisé |
| users.suspend | Suspendre ou réactiver un utilisateur |
| users.delete | Supprimer, c'est-à-dire anonymiser, un utilisateur |
| verifications.identity | Consulter les pièces d'identité des transporteurs et les valider ou refuser |
| verifications.pro | Consulter les dossiers pro et les valider, refuser ou révoquer |
| parcels.view | Liste et détail des colis, offres et trajets |
| parcels.moderate | Forcer un statut, masquer ou supprimer une annonce ou un trajet |
| reviews.moderate | Masquer ou supprimer un avis |
| reports.handle | Traiter les signalements |
| disputes.handle | Instruire et trancher les litiges, voir l'historique GPS du colis |
| conversations.view_reported | Lire une conversation seulement via un signalement ou un litige qui la cite |
| conversations.view_all | Lire n'importe quelle conversation ; chaque accès est journalisé |
| broadcast.send | Envoyer une notification à un segment d'utilisateurs |
| wallet.manage | Valider ou refuser les recharges de portefeuille, ajuster un solde avec motif |
| content.manage | Modifier la FAQ, les CGU et la politique de confidentialité |
| settings.manage | Barème de prix, limites et durées. Réservée au super-administrateur |
| staff.manage | Créer, modifier et désactiver des modérateurs. Réservée au super-administrateur |
| audit.view | Lire le journal d'audit. Réservée au super-administrateur |

Modèles pré-cochés :

- **Vérificateur** : dashboard.view, users.view, verifications.identity, verifications.pro.
- **Modérateur contenu** : dashboard.view, users.view, users.suspend, parcels.view, parcels.moderate, reviews.moderate, reports.handle, conversations.view_reported.
- **Support** : dashboard.view, users.view, users.view_pii, parcels.view, disputes.handle, conversations.view_reported.

**Règle de masquage.** Sans users.view_pii, l'API renvoie l'email sous la forme `a•••@gmail.com` et le téléphone sous la forme `+213 5•• •• •• 12`. Les fichiers d'identité et les justificatifs pro ne sont jamais servis sans la permission de vérification correspondante. Le masquage se fait dans l'API, jamais dans l'interface.

## Stack et architecture

Le projet est un monorepo TypeScript géré avec pnpm et Turborepo. Il contient trois applications (mobile, API, back-office) et un package partagé. Le temps réel passe par Socket.IO, les fichiers par Cloudinary, les données par MongoDB, les files et l'état éphémère par Redis.

| Couche | Choix | Rôle |
|---|---|---|
| Mobile | Expo SDK 58, React Native 0.88, Expo Router, TypeScript | Application Android et iOS, téléphone et tablette, portrait |
| État serveur (mobile et back-office) | TanStack Query v5 | Cache, pagination infinie, mises à jour optimistes |
| État client mobile | Contextes React (session, langue, socket) + Zustand persisté pour le brouillon de colis | — |
| Formulaires | react-hook-form + zod, schémas importés de shared | Validation identique côté client et serveur |
| Cartes | react-native-maps : Google Maps sur Android, Apple Plans sur iOS | Sélecteur d'adresse, détail, suivi |
| Géocodage | Appelé par l'API uniquement : OpenStreetMap par défaut (Photon pour la recherche, Nominatim pour l'adresse d'un point), gratuit et sans clé ; Google si une clé est configurée (jamais embarquée) ; repli sur shared/geo | Recherche d'adresses et de lieux, adresse lisible à partir d'un point |
| Géolocalisation | expo-location + expo-task-manager | Position en arrière-plan pendant la livraison |
| Notifications | expo-notifications ; côté API expo-server-sdk | Push et centre de notifications |
| Stockage sécurisé | expo-secure-store | Jeton de rafraîchissement, identifiant d'appareil |
| i18n | i18next + react-i18next + expo-localization | Français par défaut, arabe en RTL |
| API | Node 20 LTS, Express 5, Mongoose 8, zod, Socket.IO 4 | REST sous /api/v1 et temps réel |
| Jobs | BullMQ sur Redis | Expirations, validation automatique, push, emails, rappels |
| Données | MongoDB Atlas en replica set (transactions) | Collections décrites plus bas |
| Éphémère | Redis | Dernière position GPS, rate limit, adaptateur Socket.IO, files |
| Fichiers | Cloudinary, upload signé direct depuis le client | Photos et avatars en public ; pièces d'identité et justificatifs pro en authenticated |
| Emails | Brevo | Codes OTP, invitations staff, rappels |
| Back-office | React 19 + Vite + React Router + TanStack Table + Tailwind CSS | Interface du staff, responsive jusqu'au téléphone |
| Observabilité | pino (logs JSON), Sentry sur les trois applications | — |
| Tests | Vitest + supertest + mongodb-memory-server (API, shared) ; Jest + React Native Testing Library (mobile) ; Playwright (back-office) | — |
| CI/CD | GitHub Actions ; EAS Build et EAS Update | Lint, types, tests, builds, mises à jour OTA |

Structure du dépôt :

```
ucolis/
  apps/
    mobile/        Expo Router : app/(auth)/, app/(tabs)/, app/parcel/[id].tsx, …
    api/           src/modules/<domaine>/{routes,controller,service,model,schemas}.ts
                   src/realtime/   Socket.IO
                   src/jobs/       BullMQ
                   src/events/     bus d'événements de domaine et abonnés
                   src/lib/        auth, permissions, cloudinary, geo, mailer, push
    admin/         src/pages/, src/components/, src/api/
  packages/
    shared/        enums.ts, schemas/, pricing.ts, geo/wilayas.json,
                   notifications.ts, permissions.ts, stateMachines.ts
  docs/            PRD.md, DECISIONS.md
  CLAUDE.md
```

Principes d'implémentation :

- Chaque module de l'API suit le même découpage. `routes` déclare les chemins et les middlewares (authenticate, requirePermission, validate(schema)). `controller` ne fait que du HTTP. `service` porte les règles métier et les transactions. `model` contient le schéma Mongoose.
- Les opérations qui touchent plusieurs documents s'exécutent dans une transaction MongoDB : accepter une offre, se désister, trancher un litige, supprimer un compte.
- Toute écriture métier émet un événement de domaine interne, par exemple `parcel.status_changed` ou `offer.created`. Des abonnés envoient ensuite les notifications, les push et les événements Socket.IO. Les services n'envoient jamais de notification directement.
- Les machines à états des colis et des offres sont déclarées dans `shared/stateMachines.ts` (table des transitions autorisées). L'API s'en sert pour valider, et le mobile pour afficher les actions possibles.
- Les variables d'environnement sont validées par zod au démarrage : MONGODB_URI, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DELIVERY_CODE_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, BREVO_API_KEY, EXPO_ACCESS_TOKEN, GOOGLE_MAPS_API_KEY, SENTRY_DSN, CORS_ORIGINS, ADMIN_URL.
- Hébergement : une instance API toujours active, sans offre gratuite qui se met en veille. S'y ajoutent MongoDB Atlas et un Redis managé. Le back-office est servi en statique.
- Schéma de lien profond de l'application : `ucolis://`, par exemple `ucolis://parcel/<id>`, `ucolis://conversation/<id>` et `ucolis://tracking/<parcelId>`.

## Machines à états

Un colis traverse 9 statuts. Chaque passage est déclenché par une personne précise, un job ou le staff, et notifié aux autres parties. Les deux tables ci-dessous sont reprises telles quelles dans `shared/stateMachines.ts`.

Une flèche absente correspond à une transition refusée par l'API (409 INVALID_TRANSITION). Le forçage par le staff, possible depuis tout statut, n'est pas dessiné.

### Transitions du colis

| De | Vers | Déclenché par | Effets |
|---|---|---|---|
| open | negotiating | Système, à la première offre | — |
| negotiating | assigned | Expéditeur qui accepte une offre, ou transporteur qui accepte une contre-offre | Transaction : offre accepted ; autres offres actives rejected avec rejectedBecauseAccepted = true ; finalPrice et assignedCarrier figés ; commission figée si elle est en vigueur (F19) ; conversation créée ou réutilisée ; code de remise généré |
| assigned | negotiating ou open | Transporteur retenu (désistement) | Offre withdrawn. Les offres rejectedBecauseAccepted repassent en pending si leurs auteurs restent éligibles (colis en negotiating) ; sinon le colis revient en open. Code invalidé ; stats.withdrawals +1 |
| open, negotiating, assigned | cancelled | Expéditeur | Motif obligatoire depuis assigned ; offres actives cancelled |
| open, negotiating | expired | Job horaire | desiredDate + parcelExpiryDays (7 jours) dépassée ; offres actives cancelled ; republication par duplication |
| assigned | in_transit | Transporteur retenu | startedAt ; partage GPS démarré |
| in_transit, delivered_pending | delivered | Transporteur retenu, avec le code de remise correct | deliveredAt ; compteurs ; commission prélevée sur le portefeuille (F19) ; GPS arrêté ; invitation à noter |
| in_transit | delivered_pending | Transporteur retenu | declaredDeliveredAt ; autoConfirmAt = +72 h ; GPS arrêté |
| delivered_pending | delivered | Expéditeur, ou job à autoConfirmAt | Mêmes effets que la remise avec code |
| in_transit, delivered_pending | disputed | Expéditeur ou transporteur retenu | Dispute créée ; previousStatus mémorisé ; validation automatique suspendue ; GPS arrêté |
| disputed | delivered ou cancelled | Staff disputes.handle | Décision motivée notifiée aux deux parties ; si livré, mêmes effets que la remise avec code |
| Tout statut | Tout statut | Staff parcels.moderate | Forçage exceptionnel avec motif et entrée d'audit ; refusé tant qu'un litige est ouvert |

### Transitions d'une offre

| De | Vers | Déclenché par | Condition ou effet |
|---|---|---|---|
| — | pending | Transporteur vérifié | Colis en open ou negotiating ; aucune autre offre active de sa part sur ce colis |
| pending | countered | Expéditeur (contre-offre) | counterCount < 3 ; prix ≥ 100 DA |
| countered | accepted | Transporteur qui accepte la contre-offre | Prix final = contre-offre ; le colis passe en assigned |
| countered | pending | Transporteur qui refuse (prix précédent) ou repropose (nouveau prix) | Nouveau tour ajouté à rounds |
| pending | accepted | Expéditeur | Le colis passe en assigned |
| pending, countered | rejected | Expéditeur, ou système quand une autre offre est acceptée | — |
| pending, countered | withdrawn | Transporteur | — |
| accepted | withdrawn | Transporteur retenu (désistement) | Seulement si le colis est en assigned |
| rejected | pending | Système après un désistement | Seulement si rejectedBecauseAccepted = true et l'auteur reste éligible |
| pending, countered | cancelled | Système | Colis annulé ou expiré |

## Fonctionnalités détaillées

L'application est découpée en 18 modules. Chaque module liste ses fonctions, les règles appliquées par l'API et ses critères d'acceptation. Les limites chiffrées marquées « réglage » sont lues dans AppSetting et modifiables par le super-administrateur.

### F1 — Démarrage, onboarding et mode invité

- Splash : lit le jeton de rafraîchissement, puis appelle `GET /health` et `GET /app/config`. Cette route renvoie la version minimale, le mode maintenance, les réglages publics et la version des CGU.
- Mise à jour forcée : si la version installée est inférieure à minAppVersion, un écran bloquant renvoie vers le store. Les mises à jour OTA (EAS Update) sont vérifiées au lancement.
- Maintenance : si maintenance = true, un écran dédié affiche le message configuré.
- Onboarding : 3 diapositives à la première ouverture, avec choix de la langue sur la première. Le drapeau `@ucolis/onboarding_done` est mémorisé dans AsyncStorage.
- Mode invité : Accueil et Annonces sont accessibles. Les onglets Publier, Messages et Profil affichent un écran « Connectez-vous ». Toute action protégée ouvre une feuille de connexion. Après connexion, l'action reprend là où elle s'était arrêtée (paramètre returnTo).
- Accueil connecté : salutation ; compteurs (colis actifs, offres actives, livraisons en cours) ; boutons « Envoyer un colis » et « Proposer un trajet » (le second si intent inclut transporteur). S'y ajoutent un raccourci vers les livraisons en cours et les dernières annonces, toutes wilayas confondues ; « Tout voir » ouvre la liste sans filtre, triée de la plus récente à la plus ancienne. Une bannière apparaît si l'email n'est pas vérifié ou si la vérification transporteur est incomplète.
- Navigation : 5 onglets en bas (Accueil, Annonces, Publier, Messages avec badge de non-lus, Profil). Une cloche avec badge dans l'en-tête de l'Accueil et des Annonces ouvre le centre de notifications.

Critères d'acceptation : un invité voit les annonces sans compte ; l'onboarding ne réapparaît jamais après avoir été vu ; une offre tentée en invité reprend après connexion ; une version trop ancienne ne peut pas dépasser l'écran de mise à jour.

### F2 — Inscription, connexion et sessions

- Inscription en 2 écrans.
  - Écran 1 : prénom et nom (2–50 caractères), email, téléphone, mot de passe et confirmation. Le téléphone est au format algérien (+213 suivi de 9 chiffres commençant par 5, 6 ou 7) et stocké en E.164. Le mot de passe compte au moins 8 caractères, dont 1 lettre et 1 chiffre.
  - Écran 2 : wilaya puis commune (liste dépendante), intent, photo facultative (caméra ou galerie), acceptation des CGU et de la politique de confidentialité (version enregistrée).
  - Aucun choix particulier ou professionnel à l'inscription. Un lien « Vous êtes une entreprise ? » explique que le statut pro se demande ensuite depuis le profil.
- Vérification de l'email : code à 6 chiffres valable 15 min, 5 essais. Le renvoi est possible après 60 s, avec 5 envois par heure au maximum. Avant vérification, le compte peut naviguer, mais publier, faire une offre ou écrire exige un email vérifié (403 EMAIL_NOT_VERIFIED).
- Connexion : email et mot de passe. L'API renvoie un jeton d'accès JWT de 15 min, gardé en mémoire, et un jeton de rafraîchissement de 30 jours, rotatif, gardé dans expo-secure-store. Le jeton de rafraîchissement est stocké haché en base et lié à un deviceId. La réutilisation d'un jeton déjà consommé révoque toute la famille de jetons de l'appareil.
- Mot de passe oublié : code à 6 chiffres par email, valable 15 min, saisi dans l'application, puis nouveau mot de passe. La réponse est identique que l'email existe ou non. Le changement révoque toutes les sessions.
- Changer le mot de passe : l'ancien est obligatoire. Les autres sessions sont révoquées.
- Appareils connectés : liste (modèle, système, dernière activité), déconnexion d'un appareil ou de tous.
- Compte suspendu : la connexion et le rafraîchissement renvoient 403 ACCOUNT_SUSPENDED avec le motif et la date de fin éventuelle. Une suspension révoque les sessions et coupe le socket immédiatement.
- Déconnexion avec confirmation : révoque le jeton de rafraîchissement et retire le jeton push de l'appareil.

Règles : email et téléphone uniques (409 EMAIL_TAKEN, 409 PHONE_TAKEN). Au plus 10 échecs d'authentification par 15 min et par IP, et 5 par email. Au-delà de 5 échecs sur un email, un délai progressif s'applique.

Critères d'acceptation : un jeton d'accès expiré est renouvelé sans que l'utilisateur le voie ; un jeton de rafraîchissement rejoué déconnecte l'appareil ; un compte suspendu est éjecté en moins de 5 s.

### F3 — Profil, préférences, blocage et suppression de compte

- Mon profil : photo, nom, badges, note moyenne. Il donne accès à Modifier le profil, Mes colis, Mes offres, Mes trajets, Mes livraisons, Mes avis, Favoris, Alertes, Statut professionnel, Vérification transporteur et véhicules, Appareils, Langue, Préférences de notification, Utilisateurs bloqués, Aide, CGU, Confidentialité, À propos, Supprimer mon compte et Déconnexion.
- Modifier le profil : prénom, nom, téléphone (unicité vérifiée), wilaya, commune, bio (500 caractères), photo. Changer d'email envoie un code au nouvel email, et l'ancien reste actif jusqu'à la validation. Pour un compte pro, la raison sociale ne se modifie que par un nouveau dossier.
- Profil public :
  - Identité affichée : prénom et initiale du nom pour un particulier, raison sociale et logo pour un pro.
  - Contenu : photo, badges, ancienneté, wilaya, statistiques (colis envoyés, colis livrés comme transporteur, taux de réussite, désistements), répartition des notes et avis, trajets actifs.
  - Boutons Contacter, Signaler et Bloquer.
- Téléphone : jamais affiché publiquement. Il n'est visible qu'entre l'expéditeur et le transporteur retenu, du statut assigned jusqu'à 7 jours après delivered, avec les boutons Appeler et WhatsApp.
- Blocage : un utilisateur bloqué ne peut plus écrire, faire d'offre sur vos colis ni vous proposer un colis. Ses annonces et trajets sont masqués pour vous. Le déblocage se fait depuis la liste des bloqués.
- Suppression de compte, exigée par l'App Store et Google Play :
  - Confirmation par mot de passe. Refus si une livraison est en cours (assigned, in_transit, delivered_pending ou disputed).
  - Délai de grâce de 14 jours : une reconnexion annule la suppression.
  - Ensuite, les colis actifs sont annulés, les offres retirées et les données personnelles anonymisées (nom remplacé par « Utilisateur supprimé », email et téléphone effacés). Les avis sont conservés sous forme anonyme. Les fichiers d'identité et les justificatifs pro sont supprimés de Cloudinary.

### F4 — Statut professionnel

- Écran « Devenir professionnel » depuis le profil, avec formulaire, envoi des justificatifs (voir Rôles), récapitulatif et envoi. Le statut passe à pending.
- Pendant pending, un bandeau « Dossier en cours d'examen » s'affiche et le dossier est en lecture seule.
- Décision notifiée en push et dans l'application. En cas de refus, le motif est affiché avec un bouton « Corriger et renvoyer ». En cas de validation, le badge apparaît et la fiche entreprise est publiée. En cas de révocation, le motif est notifié et le compte redevient particulier.
- Côté staff, l'écran de vérification affiche les pièces à côté des données saisies, avec une liste de contrôle : pièce lisible, nom concordant, NIF à 15 chiffres, document en cours de validité.

Critères d'acceptation : aucune route utilisateur ne peut écrire accountType ni pro.status ; un compte non validé n'affiche jamais le badge pro ; un refus sans motif est rejeté par l'API.

### F5 — Vérification du transporteur et véhicules

- Envoi des 4 pièces (carte d'identité en 2 faces) et saisie des dates d'expiration du permis et de l'assurance. Le statut passe à pending.
- Véhicules : 1 à 5 par compte, dont un par défaut. Chacun a un type (moto, car, station_wagon, utility, van, truck, cargo, semi_trailer), une marque, un modèle, une immatriculation, une capacité en kg, un volume en m³ et une photo. Le public ne voit de l'immatriculation que les 3 derniers chiffres.
- Job quotidien d'expiration avec rappels à J-30 et J-7.
- Tant que la vérification n'est pas approuvée, une bannière « Complétez votre vérification pour faire des offres » s'affiche, et les boutons d'offre ouvrent l'écran de vérification.

Critères d'acceptation : un transporteur non vérifié reçoit 403 CARRIER_NOT_VERIFIED sur toute offre ou tout trajet ; une assurance expirée fait passer le dossier à expired le jour même.

### F6 — Publication d'un colis (rapide par défaut, ou assistant en 4 étapes)

**Publication rapide (par défaut).** Un seul écran : adresses de départ et d'arrivée (même sélecteur que l'étape Trajet), titre, description facultative, prix demandé (pré-rempli avec le prix suggéré sur la seule distance), photos facultatives et déclaration des objets interdits. Poids, dimensions et date restent « non précisés », tout véhicule convient et le règlement est à convenir. Un bouton « Ajouter plus de détails » ouvre l'assistant complet ci-dessous avec le même brouillon. Détails dans `docs/DECISIONS.md` (21 octobre 2026).

**Publication complète (assistant en 4 étapes) :**

1. **Trajet** : adresses de départ et d'arrivée choisies comme dans une application de VTC : deux champs reliés (Départ, Arrivée), suggestions pendant la frappe (communes de shared/geo immédiatement, lieux et rues par l'API ensuite), « Ma position actuelle », adresses récentes de l'appareil (effacées à la déconnexion) et « Choisir sur la carte », où le repère reste fixe au centre et l'on fait glisser la carte dessous. La wilaya et la commune sont déduites du point (commune dont le centre est le plus proche, dans shared/geo) et restent corrigeables à la main. Un champ libre de précision accompagne chaque adresse (rue, repère, étage).
2. **Colis** :
   - Titre (5–80 caractères), catégorie (documents, clothing, electronics, food_non_perishable, furniture, appliances, auto_parts, other), description (1 000 caractères au maximum).
   - Poids saisi en g ou kg, stocké en kg (0,1 à 30 000). Dimensions saisies en cm ou m, stockées en cm (1 à 1 500 par côté), avec calcul automatique du volume en m³.
   - Case « Fragile ».
   - Case obligatoire de déclaration des objets interdits : argent liquide, armes, produits illicites, matières dangereuses, animaux vivants, denrées périssables non emballées.
3. **Détails** :
   - Types de véhicule acceptés : au moins 1, pré-cochés selon le poids et le volume.
   - Date souhaitée, d'aujourd'hui à un an, avec un créneau (morning, afternoon, evening, any), une heure précise facultative (le créneau en découle : avant 12 h matin, avant 18 h après-midi, sinon soir) et une option « Dates flexibles (±2 jours) ».
   - Option « Urgent ».
   - Destinataire (nom et téléphone), facultatif mais recommandé.
   - Règlement convenu : cash_on_pickup, cash_on_delivery, paid_by_recipient ou other. Le paiement se fait hors de l'application.
   - Prix demandé, pré-rempli avec le prix suggéré et marqué « estimé ». Minimum 100 DA. Un avertissement non bloquant s'affiche au-dessus de 3 fois le prix suggéré.
4. **Photos** : facultatives, 5 au maximum, depuis la galerie ou la caméra. Chaque photo est redimensionnée à 1 600 px de côté maximum et compressée en JPEG qualité 0,7, puis envoyée directement sur Cloudinary par upload signé, avec une barre de progression. Les photos se réordonnent ; la première sert de couverture.

Un récapitulatif précède la publication. Chaque étape est validée avant la suivante. En cas d'erreur à l'envoi, l'assistant revient à l'étape fautive avec le champ en erreur. Le brouillon est sauvegardé localement et proposé à la reprise si l'application a été fermée.

**Prix suggéré.** Un seul barème fait foi : la fonction `suggestPrice` de `shared/pricing.ts`. Le mobile l'utilise pour l'affichage, et l'API recalcule suggestedPrice et distanceKm à l'enregistrement, en ignorant les valeurs du client. Les coefficients sont des réglages.

```
W = max(P, 200 × V)                       poids taxé
T = min(8, 1 + W / 50)                    facteur de taille
Prix suggéré = max(200, 50 × ⌈ (150 + C(d) × T + H(W)) × (1 + 0,1 si fragile) / 50 ⌉)
```

- P est le poids réel en kg et V le volume en m³ ; 200 kg/m³ est le facteur de poids volumétrique.
- d est la distance à vol d'oiseau en km (formule de Haversine) entre les points de départ et d'arrivée.
- C(d) est le coût kilométrique d'un petit colis, par tranches marginales : 1,2 DA/km sur les 100 premiers km, 0,8 DA/km de 100 à 300 km, 0,5 DA/km de 300 à 600 km, 0,3 DA/km au-delà.
- T traduit la taille du véhicule nécessaire : 1 pour un colis sans poids, 2 pour 50 kg taxés, plafonné à 8 (camionnette pleine). Le poids pèse donc surtout par la distance, et non plus au kilo quel que soit le trajet.
- H(W) est la manutention, par tranches marginales de poids taxé : 10 DA/kg jusqu'à 30 kg, 6 DA/kg de 30 à 200 kg, 2 DA/kg au-delà.
- Un colis fragile est majoré de 10 %. En publication rapide (poids et volume nuls), le prix ne dépend que de la distance : 150 + C(d).
- Calibrage : le prix suggéré reste sous les tarifs des sociétés de livraison algériennes (relevés indicatifs 2026 : 400 à 600 DA dans la même ville, 500 à 750 DA entre wilayas, 1 000 à 1 400 DA vers le Grand Sud, plus environ 50 DA par kilo au-delà de 5 kg). Un petit colis coûte environ 200 DA dans la ville, 350 DA entre wilayas proches, 450 DA de Sétif à Alger, 600 DA d'Alger à Oran et 950 DA d'Alger à Tamanrasset ; un réfrigérateur dans la ville environ 1 500 DA, une camionnette pleine dans la ville environ 2 500 DA.
- Exemple : Alger → Oran, 352 km, 5 kg, 40 × 30 × 30 cm (0,036 m³). C = 120 + 160 + 26 = 306 DA. Le poids taxé est max(5 ; 7,2) = 7,2 kg, d'où T = 1,144 et H = 72 DA. Le total de 150 + 350 + 72 = 572 DA est arrondi à 600 DA.
- Exemple : réfrigérateur de 60 kg, 70 × 70 × 180 cm (0,882 m³, soit 176,4 kg taxés), fragile, 2 km dans la même ville. T = 4,528, C = 2,4 DA, H = 300 + 878 = 1 178 DA. (150 + 11 + 1 178) × 1,1 = 1 473 DA, arrondi à 1 500 DA.

Règles :

- Départ et arrivée géolocalisés obligatoires.
- Au plus 5 colis actifs pour un particulier et 20 pour un pro (réglages). Un colis est actif en open, negotiating, assigned, in_transit, delivered_pending ou disputed.
- Un compte pro peut « Dupliquer » un colis existant : l'assistant s'ouvre pré-rempli, avec une nouvelle date.
- Une référence lisible est générée, par exemple UC-2610-4821.
- Modification : possible en open et negotiating. Si le trajet, le poids, les dimensions ou la date changent alors que des offres sont actives, leurs auteurs reçoivent la notification « Annonce modifiée ». Aucune modification n'est possible après assigned.
- Suppression avant acceptation : le colis passe en cancelled, les offres actives en cancelled, et leurs auteurs sont notifiés.

Critères d'acceptation : un colis complet se publie en moins de 3 minutes sur un téléphone de milieu de gamme ; un suggestedPrice envoyé par le client est ignoré ; la sixième publication active d'un particulier renvoie 422 ACTIVE_PARCEL_LIMIT.

### F7 — Annonces : recherche, filtres, carte et favoris

- Liste à pagination infinie (20 par page, 50 au maximum). Tris : plus récentes (par défaut), date souhaitée la plus proche, prix décroissant, plus proches de moi (avec la localisation).
- Recherche texte sur le titre, la description, les communes et les wilayas. Elle est limitée à 100 caractères, échappée, et sans sensibilité aux accents.
- Filtres : wilaya de départ, wilaya d'arrivée, poids maximum, type de véhicule, urgent, plage de dates, prix minimum et maximum, rayon autour de moi (10, 25, 50 ou 100 km), comptes pro uniquement, identité vérifiée uniquement. Les filtres actifs s'affichent en puces supprimables une à une, avec un bouton « Réinitialiser ». Ils sont mémorisés entre deux sessions.
- Vue carte en bascule avec la liste : marqueurs de départ regroupés par zone, et aperçu de l'annonce au toucher.
- Visibilité : la liste publique ne montre que open et negotiating, hors annonces masquées et hors utilisateurs bloqués. Un colis dans un autre statut reste visible de ses participants. Par lien direct, les autres voient « Cette annonce n'est plus disponible ».
- Carte d'annonce : photo de couverture, titre, trajet (commune et wilaya), distance, poids, date souhaitée, prix demandé, nombre d'offres, badges Urgent et Fragile. On y voit aussi l'expéditeur : nom affiché, note, badges Pro et Identité.
- Détail du colis :
  - Photos en carrousel plein écran, caractéristiques, catégorie.
  - Mini-carte avec départ, arrivée et ligne droite, et bouton « Ouvrir dans Maps ».
  - Date et créneau, règlement convenu, profil de l'expéditeur cliquable, nombre d'offres.
  - Le montant des offres n'est visible que par l'expéditeur.
  - Barre d'actions contextuelle (tableau ci-dessous).
- Favoris : un cœur sur la carte et sur le détail, une liste dans le profil. Une notification part si un favori est attribué, annulé ou expiré.
- Partager une annonce par la feuille de partage du système, avec un lien `ucolis://parcel/<id>`.

| Qui regarde | Statut | Actions proposées |
|---|---|---|
| Visiteur | open, negotiating | Se connecter pour faire une offre |
| Transporteur (pas encore d'offre) | open, negotiating | Accepter le prix demandé ; Proposer un prix ; Favori ; Signaler |
| Transporteur (offre active) | open, negotiating | Voir mon offre ; Répondre à la contre-offre ; Retirer mon offre |
| Expéditeur | open, negotiating | Voir les offres ; Modifier ; Annuler l'annonce ; Partager |
| Expéditeur | assigned | Message ; Appeler ; Voir le code de remise ; Annuler la livraison |
| Transporteur retenu | assigned | Démarrer la livraison ; Message ; Appeler ; Se désister |
| Expéditeur | in_transit | Suivre ; Message ; Appeler ; Voir le code de remise ; Ouvrir un litige |
| Transporteur retenu | in_transit | Saisir le code de remise ; Déclarer la livraison ; Message ; Ouvrir un litige |
| Expéditeur | delivered_pending | Confirmer la réception ; Ouvrir un litige |
| Transporteur retenu | delivered_pending | Saisir le code de remise ; Message ; Ouvrir un litige |
| Les deux | delivered | Noter (si non fait) ; Message |

### F8 — Offres et négociation

Côté transporteur :

- Accepter le prix demandé en un geste. Une offre est créée au prix de l'annonce (atAskingPrice = true), avec le libellé « Un transporteur accepte votre prix ».
- Proposer un prix : montant (100 DA minimum), véhicule choisi parmi les siens, date d'enlèvement proposée. Pas de message : offres et contre-offres ne portent que le prix (voir F13).
- Répondre à une contre-offre :
  - L'accepter : l'offre est acceptée au prix de la contre-offre et le colis passe en assigned.
  - La refuser : l'offre revient en pending au prix précédent.
  - Proposer un nouveau prix : l'offre revient en pending au nouveau prix.
- Retirer son offre tant qu'elle n'est pas acceptée.
- Mes offres : onglets Actives, Acceptées et Terminées, avec le statut et le dernier prix.

Côté expéditeur :

- Liste des offres triable par prix ou par note. Chaque carte montre le transporteur (note, badges, nombre de livraisons, type de compte), le véhicule, la date d'enlèvement, le message et l'historique des tours de négociation.
- Accepter une offre après une confirmation qui rappelle le prix final.
  - Le colis passe en assigned et le prix final est figé.
  - Les autres offres actives passent en rejected, et leurs auteurs sont notifiés.
  - La conversation du colis est créée ou réutilisée, et le code de remise est généré.
- Refuser une offre.
- Contre-proposer un prix (100 DA minimum) avec un message.

Règles :

- Une offre n'est possible qu'en open ou negotiating, sans transporteur retenu, par un transporteur vérifié, ni propriétaire du colis ni bloqué par lui.
- Une seule offre active (pending ou countered) par transporteur et par colis, garantie par un index unique partiel.
- Une négociation compte 3 contre-offres au maximum. Au-delà, seules l'acceptation et le refus restent possibles.
- La première offre fait passer le colis de open à negotiating.
- L'acceptation est atomique : transaction, et mise à jour conditionnelle du colis sur status ∈ {open, negotiating} et assignedCarrier = null. Une seconde acceptation simultanée renvoie 409 PARCEL_ALREADY_ASSIGNED.
- Le véhicule de l'offre doit figurer parmi les types acceptés par l'annonce (422 VEHICLE_NOT_ACCEPTED).

Critères d'acceptation : deux acceptations concurrentes produisent exactement un assigned ; une quatrième contre-offre est refusée ; chaque changement d'état d'offre notifie l'autre partie.

### F9 — Trajets publiés par les transporteurs

- Un transporteur vérifié publie un trajet :
  - Départ (wilaya, commune), arrivée, de 0 à 5 wilayas étapes, date et heure de départ.
  - Véhicule, capacité disponible en kg et en m³.
  - Prix indicatif facultatif, au forfait ou en DA par kg.
  - Récurrence facultative (chaque semaine, jours choisis, sur 8 semaines au plus) et note libre (300 caractères).
- Statuts : active, full (déclaré par le transporteur), completed (automatique 24 h après le départ), cancelled.
- Liste des trajets : l'onglet Annonces propose un sélecteur « Colis | Trajets ». Filtres : départ, arrivée, date, type de véhicule.
- Proposer mon colis depuis un trajet : l'expéditeur choisit un de ses colis compatible. Le colis doit être en open ou negotiating, ses wilayas de départ et d'arrivée doivent figurer dans l'ordre sur l'itinéraire, son poids doit tenir dans la capacité, et la date souhaitée doit être à ±2 jours du départ. Une TripRequest est créée, et le transporteur est notifié. Il répond par une offre classique, pré-remplie, ou décline.
- Une seule demande par colis et par trajet. Un expéditeur envoie au plus 10 demandes par jour.
- Correspondances automatiques :
  - À la publication d'un colis, les transporteurs dont un trajet actif est compatible reçoivent « Un colis correspond à votre trajet ».
  - À la publication d'un colis, les transporteurs proches du départ reçoivent « Nouveau colis près de vous » (distance en km). Proche : dernière position du transporteur, envoyée à l'ouverture de l'application puis toutes les 15 min, si elle date de moins de 24 h, sinon la commune de son profil, dans un rayon réglable (nearbyParcels.radiusKm, 30 km). Au plus nearbyParcels.dailyPushLimit push (5) par transporteur sur 24 h ; au-delà, notification dans l'application seulement. Ni l'expéditeur, ni les comptes bloqués, ni les transporteurs déjà prévenus par un trajet.
  - À la publication d'un trajet, l'application affiche les colis compatibles déjà publiés.
  - Ces notifications sont regroupées : au plus 1 par trajet et par heure.

Critères d'acceptation : un colis Sétif → Alger est proposé au trajet Constantine → Sétif → Bouira → Alger, mais pas au trajet Alger → Sétif ; un trajet passe en completed sans action humaine.

### F10 — Alertes et recherches enregistrées

- « Enregistrer cette recherche » depuis les filtres des annonces ou des trajets : nom, filtres courants, notification activée ou non. 10 alertes au maximum par compte.
- Quand une nouvelle annonce correspond, une notification new_listing_match part. Les envois sont regroupés : au plus 1 push par alerte et par heure, du type « 3 nouveaux colis Sétif → Alger ».
- À la première activation du profil transporteur, l'application propose de créer une alerte sur ses wilayas habituelles.
- Les alertes se gèrent dans le profil : liste, activer ou désactiver, modifier, supprimer.

### F11 — Livraison, code de remise et validation

- Code de remise :
  - Généré à l'acceptation : 4 chiffres aléatoires, stockés chiffrés (AES-256-GCM avec DELIVERY_CODE_KEY).
  - Visible seulement par l'expéditeur, dans le détail du colis, avec un bouton « Envoyer au destinataire » (feuille de partage : SMS, WhatsApp).
  - Le destinataire le donne au transporteur à la remise.
- Démarrer la livraison (assigned → in_transit) : par le transporteur retenu, après confirmation. L'application obtient d'abord les permissions de localisation au premier plan et en arrière-plan (voir F12). Le refus de la localisation en arrière-plan n'empêche pas de démarrer, mais l'expéditeur voit « Suivi indisponible ».
- Remise avec code (in_transit ou delivered_pending → delivered) : le transporteur saisit le code. Un code correct termine la livraison sans validation de l'expéditeur, y compris après une déclaration. Après 5 erreurs, la saisie est bloquée (l'action disparaît) et le transporteur doit déclarer la livraison.
- Déclarer la livraison sans code (in_transit → delivered_pending) : photo de preuve et note facultatives. La validation automatique est programmée 72 h plus tard (réglage autoConfirmHours). L'expéditeur est relancé à +24 h et +60 h.
- Confirmer la réception (delivered_pending → delivered) par l'expéditeur, ou automatiquement à l'échéance s'il n'a pas ouvert de litige.
- À la livraison :
  - deliveredAt est enregistrée et les compteurs mis à jour (parcelsSent de l'expéditeur, parcelsCarried du transporteur).
  - Le partage GPS s'arrête et les deux parties sont invitées à noter.
- Annulation par l'expéditeur : possible en open, negotiating et assigned. Le motif est obligatoire en assigned, et le transporteur retenu est notifié. Une fois la livraison démarrée, l'expéditeur ne peut plus annuler : il ouvre un litige.
- Désistement du transporteur (seulement en assigned) :
  - Son offre passe en withdrawn et son compteur de désistements augmente.
  - Les offres refusées à cause de l'acceptation repassent en pending si leurs auteurs restent éligibles, et le colis revient en negotiating. Sinon, il redevient open.
  - L'expéditeur et les transporteurs réactivés sont notifiés, et le code de remise est invalidé.
  - 3 désistements en 30 jours signalent automatiquement le compte au staff.
- Retard : si un colis reste en in_transit 3 jours après la date souhaitée, les deux parties sont relancées et peuvent ouvrir un litige.

Critères d'acceptation : toute transition absente de la table de la machine à états est refusée (409 INVALID_TRANSITION) ; seul le transporteur retenu démarre, saisit le code ou déclare ; seul l'expéditeur confirme ; la validation automatique ne part jamais sur un colis en litige.

### F12 — Suivi GPS en temps réel

- Information préalable : avant la demande système, un écran explique pourquoi la position est partagée, pendant combien de temps et avec qui. Google Play impose cette « information bien visible ».
- Côté transporteur, dès in_transit :
  - Tâche de localisation en arrière-plan (expo-task-manager), précision équilibrée, toutes les 10 s ou tous les 25 m.
  - Sur Android, un service de premier plan affiche la notification permanente « Votre position est partagée avec l'expéditeur ». Sur iOS, l'indicateur système de localisation s'affiche.
  - Sans arrière-plan (autorisation « Pendant l’utilisation », ou Expo Go sur iPhone), repli sur un suivi application ouverte, repris à l’ouverture de la fiche du colis ; le transporteur est prévenu. La livraison démarre dans tous les cas.
  - Envoi par le socket (tracking:position). Hors connexion, seule la dernière position est conservée, puis envoyée au retour du réseau.
- Côté serveur :
  - La dernière position est gardée dans Redis (`tracking:<parcelId>`, durée de vie 24 h).
  - Un point par minute est historisé dans TrackPoint (durée de vie 30 jours) pour l'instruction des litiges.
- Côté expéditeur, écran Suivi :
  - Carte avec le marqueur du transporteur orienté selon son cap, le départ, l'arrivée et la ligne droite.
  - « Mis à jour il y a X s », état de connexion, boutons Appeler et Message.
  - À l'ouverture, la dernière position connue est demandée au serveur.
  - Au-delà de 5 minutes sans position, l'écran affiche « Position non reçue depuis 5 min ».
- Arrêt : quand le colis quitte in_transit, à la déconnexion ou à la suppression du compte.
- Accès : seuls l'expéditeur, le transporteur retenu et le staff disputes.handle (pendant un litige) peuvent rejoindre la room de suivi.

Critères d'acceptation : la position arrive chez l'expéditeur en moins de 15 s, application du transporteur en arrière-plan et écran éteint ; aucune position n'est envoyée hors in_transit ; la dernière position survit à un redémarrage de l'API.

### F13 — Messagerie

- Aucun échange de messages entre l'expéditeur et le transporteur avant l'acceptation d'une offre (prix de la course validé) : la négociation porte uniquement sur le prix. L'API refuse l'ouverture d'une conversation et l'envoi d'un message avec MESSAGING_LOCKED ; une conversation encore verrouillée est en lecture seule.
- Une conversation par paire d'utilisateurs et par colis : le contexte reste clair quand deux personnes partagent plusieurs colis.
  - Elle est créée à l'acceptation d'une offre (ou un désistement après acceptation : la livraison a été acceptée).
  - Une conversation générale sans colis peut s'ouvrir depuis un profil public avec « Contacter », seulement entre deux personnes qui ont déjà eu une livraison acceptée ensemble. Elle est unique par paire, et limitée à 10 nouvelles conversations par jour et par compte.
- Liste : avatar, nom, titre du colis concerné, dernier message, heure, compteur de non-lus. Mise à jour en direct. Possibilité de mettre une conversation en sourdine.
- Discussion :
  - Messages texte (2 000 caractères) et image (une par message, compressée).
  - Messages système automatiques, par exemple « Offre acceptée à 3 250 DA » ou « Livraison démarrée ».
  - Envoi optimiste avec un clientId pour dédoublonner, et nouvel essai en cas d'échec.
  - Indicateur « en train d'écrire » (3 s), accusé « Vu », chargement des anciens messages par pages de 30.
  - En-tête cliquable vers le colis.
- Actions : signaler un message ou la conversation, bloquer l'utilisateur.
- Supprimer une conversation de sa liste (glisser la ligne vers le début de la lecture, ou appui long, avec confirmation). Elle disparaît pour soi seul : l'autre participant et le staff la gardent. Ses non-lus sont remis à zéro sans accusé « Vu ». Elle revient avec son historique au message suivant ou quand on la rouvre.
- Badge du total des non-lus sur l'onglet Messages, synchronisé par le socket.
- Les messages d'un compte supprimé restent, avec l'auteur « Utilisateur supprimé ».

### F14 — Notifications

- Push par le service Expo :
  - Au démarrage et après connexion, l'appareil enregistre son jeton (POST /me/push-tokens avec deviceId et plateforme). Un compte peut avoir plusieurs appareils.
  - Les jetons rejetés par Expo (DeviceNotRegistered) sont supprimés lors de la lecture des accusés.
  - Les push de messages sont regroupés par conversation (threadId sur iOS, tag sur Android).
- Centre de notifications : liste chronologique paginée, marquer comme lue, tout marquer comme lu, supprimer une notification ou toutes. Un toucher ouvre l'élément concerné par lien profond. Les notifications sont conservées 90 jours.
- Préférences par catégorie, enregistrées côté serveur : Offres, Livraisons, Messages, Alertes et trajets, Compte et vérification, Annonces UCOLIS. La catégorie Compte et vérification ne se désactive pas.
- Le catalogue des événements figure dans la section Notifications.

### F15 — Avis et réputation

- Après delivered, l'expéditeur et le transporteur sont invités à se noter, avec une relance à +3 jours. La fenêtre d'avis dure 14 jours.
- Contenu d'un avis :
  - Une note globale de 1 à 5 étoiles.
  - Des critères facultatifs, notés de 1 à 5 : ponctualité, soin du colis et communication pour un transporteur ; exactitude de l'annonce, disponibilité et communication pour un expéditeur.
  - Un commentaire facultatif de 500 caractères.
- Double aveugle : un avis n'est publié que lorsque les deux personnes se sont notées (sur ce colis ou sur un autre), ou à la fin des 14 jours. Personne ne note en réaction à l'autre.
- Une seule note par personne : un avis par auteur et par personne notée, tous colis confondus (409 ALREADY_REVIEWED) ; il n'est pas modifiable. La personne notée peut répondre une fois, publiquement (300 caractères).
- La moyenne et le nombre d'avis sont recalculés à chaque publication ou masquage. Seuls les avis publiés et non masqués comptent.
- Statistiques de confiance sur le profil :
  - Taux de réussite : livrés / (livrés + désistements + litiges perdus).
  - Ancienneté.
  - Délai médian de réponse aux messages.

### F16 — Signalements et litiges

**Signalements**

- Tout utilisateur connecté peut signaler un utilisateur, une annonce, un trajet, un avis, une conversation ou un message.
- Motifs : inappropriate, scam, fake_listing, abusive_behavior, spam, prohibited_item, other. Description de 1 000 caractères au maximum.
- On ne peut ni se signaler soi-même, ni signaler deux fois le même élément tant que le premier signalement est ouvert (409 ALREADY_REPORTED).
- Masquage automatique : une annonce ou un trajet signalé par 3 utilisateurs distincts est masqué en attendant l'examen du staff.

**Litiges**

- Ouverts par l'expéditeur ou le transporteur, en in_transit ou delivered_pending. Le colis passe en disputed et la validation automatique est suspendue.
- Motifs : not_delivered, damaged, lost, price_disagreement, no_show, delay, other. Description (2 000 caractères) et jusqu'à 5 photos.
- L'autre partie est notifiée et dispose de 48 h pour donner sa version, avec des photos.
- Un membre du staff disputes.handle prend le dossier. Il voit le colis, l'historique des statuts, les offres, la conversation et l'historique GPS.
- La décision tranche entre delivered et cancelled, avec une note motivée visible des deux parties. Une sanction éventuelle, comme une suspension, est une action séparée.
- Un litige tranché contre un transporteur compte dans son taux de réussite.

### F17 — Aide et contenus

- FAQ par rubriques, avec recherche. Contenu géré dans le back-office, en français et en arabe.
- Contact par email et par WhatsApp. Les coordonnées sont des réglages.
- CGU et politique de confidentialité versionnées. Quand une nouvelle version est publiée, l'utilisateur doit l'accepter à sa prochaine ouverture de l'application.
- À propos : version de l'application, numéro de build, canal de mise à jour.

### F18 — Back-office du staff

Application web responsive, servie à part de l'application mobile. Chaque page et chaque action vérifient la permission côté API ; l'interface masque ce qui n'est pas permis.

| Page | Permission | Contenu et actions |
|---|---|---|
| Connexion | — | Email, mot de passe, code TOTP ; première connexion par lien d'invitation avec configuration de la 2FA |
| Tableau de bord | dashboard.view | Utilisateurs (total, actifs sur 30 jours, nouveaux ce mois, suspendus) ; colis par statut ; montant total déclaré des livraisons ; taux de livraison ; délai médian avant la première offre ; files en attente avec l'âge du plus ancien dossier ; consommation Cloudinary du mois (crédits, stockage, bande passante, transformations ; alerte à 80 % et 95 %) |
| Utilisateurs | users.view | Recherche ; filtres statut, intent, type de compte, wilaya, vérifié ; fiche avec profil, colis, offres, trajets, avis, signalements, litiges, appareils ; suspendre avec motif et durée ; réactiver ; supprimer |
| Vérifications identité | verifications.identity | File pending, la plus ancienne en premier ; visionneuse de pièces avec zoom et rotation ; valider ou refuser avec motif |
| Statut pro | verifications.pro | File des dossiers ; liste de contrôle ; valider, refuser ou révoquer avec motif |
| Colis | parcels.view | Recherche par référence ou titre ; filtres statut et wilaya ; détail avec offres, historique, conversation (selon permission) ; forcer un statut, masquer, supprimer (parcels.moderate) |
| Trajets | parcels.view | Liste, détail, masquer, supprimer |
| Litiges | disputes.handle | File ; prise en charge ; dossier complet avec carte GPS ; décision motivée |
| Signalements | reports.handle | Filtres statut et type ; ouvrir la cible ; marquer traité ou ignoré avec note interne |
| Avis | reviews.moderate | Liste filtrable ; masquer ou supprimer avec motif |
| Conversations | conversations.view_reported ou conversations.view_all | Lecture seule ; recherche par participant ; suppression d'un message abusif |
| Diffusion | broadcast.send | Message bilingue ; segment (tous, transporteurs, expéditeurs, pros, wilaya) ; aperçu du nombre de destinataires ; envoi immédiat ou programmé |
| Contenus | content.manage | FAQ, CGU, confidentialité, avec éditeur Markdown, versions et publication |
| Portefeuilles | wallet.manage | File des recharges (la plus ancienne en premier) avec preuve de virement en URL signée ; créditer le montant reçu ou refuser avec motif ; soldes triés du plus bas au plus haut ; historique ; ajustement motivé |
| Réglages | settings.manage | Barème de prix, limites, durées, coordonnées de contact, version minimale de l'app, maintenance, requireCarrierVerification, commission (activation, date d'effet, grille, bonus, seuil, coordonnées de virement) |
| Staff | staff.manage | Liste ; inviter un modérateur avec modèle de permissions ; modifier les permissions ; désactiver ; transférer le rôle de super-administrateur |
| Journal d'audit | audit.view | Qui, quoi, sur quoi, quand, motif, avant et après ; filtres ; export CSV |

Règles transverses :

- Prise en charge des dossiers (vérifications, litiges, signalements) : un clic « Prendre le dossier » le réserve 30 min à un membre du staff, pour éviter que deux personnes traitent le même.
- Les listes paginent côté serveur et s'exportent en CSV. Les colonnes personnelles n'y figurent qu'avec users.view_pii.
- Toute action d'écriture du staff exige un motif et crée une entrée AuditLog.
- Une session staff expire après 30 min d'inactivité.

Critères d'acceptation : un modérateur sans users.view_pii ne reçoit jamais un email ou un téléphone en clair, y compris dans les exports et les réponses JSON ; un modérateur ne peut ni voir ni modifier ses propres permissions ; le super-administrateur ne peut pas être désactivé.

### F19 — Commission et portefeuille du transporteur

Le service est gratuit au lancement : la commission n'existe qu'une fois activée par le super-administrateur (réglage `commission.enabled`). Avant de l'activer, il prévient les transporteurs par une diffusion et fixe une date d'entrée en vigueur (`effectiveFrom`).

- Grille (dans `shared/commission.ts`, modifiable dans les réglages) : frais de dossier fixes de 50 DA, plus un pourcentage du prix convenu. Le taux dépend de la tranche où tombe le prix entier, sans tranches marginales : 15 % sous 1 000 DA, 12 % de 1 000 à 3 000 DA inclus, 10 % de 3 001 à 10 000 DA inclus, 8 % au-delà. Montants arrondis au dinar ; la commission ne dépasse jamais le prix convenu.
- Gains nets du transporteur = prix convenu − frais de dossier − commission variable.
- La commission est figée sur le colis à l'acceptation de l'offre, si elle est en vigueur à cet instant. Elle est prélevée sur le portefeuille du transporteur dans la transaction qui passe le colis en delivered (code, confirmation, validation automatique, litige tranché pour la livraison, forçage par le staff). Un désistement l'efface. Si la gratuité revient avant la livraison, elle est abandonnée (waived). Si le staff sort un colis de delivered, elle est remboursée.
- Portefeuille : un par transporteur, ouvert avec un bonus de bienvenue de 1 000 DA (une seule fois par compte), à la validation de l'identité ou au premier accès si la commission est activée. Le solde peut devenir négatif.
- Blocage : sous le seuil `minBalance` (0 DA), le transporteur ne peut plus faire d'offre, reproposer un prix, accepter une contre-offre ni être retenu par un expéditeur (422 WALLET_INSUFFICIENT_BALANCE ; l'expéditeur reçoit CARRIER_UNAVAILABLE). Il est prévenu au passage sous le seuil.
- Recharge : virement CCP ou BaridiMob vers les coordonnées des réglages, puis demande avec montant, référence facultative et preuve (image ou PDF privés). Une seule demande en attente à la fois. Le staff crédite le montant réellement reçu ou refuse avec un motif ; le transporteur est notifié.
- Écrans : ventilation des gains (prix convenu, frais de dossier, commission au taux appliqué, gains nets mis en valeur) sur la saisie d'offre, le détail d'une offre et la fiche colis du transporteur, avec une icône d'information qui ouvre la grille ; « Mon portefeuille » depuis le profil (solde en rouge si négatif, en vert sinon ; historique avec références de livraison ; « Recharger mon compte »). L'expéditeur ne voit jamais la commission.

Critères d'acceptation : aucune commission n'est figée ni prélevée tant que `commission.enabled` est faux ; une livraison n'est jamais prélevée deux fois ; chaque mouvement de solde a sa ligne d'historique avec le solde qui en résulte ; un transporteur sous le seuil ne peut obtenir aucune nouvelle course.

## Modèle de données

Les données tiennent dans 21 collections MongoDB, toutes avec createdAt et updatedAt (option timestamps). Les noms de champs sont en anglais, en camelCase. Les références sont des ObjectId. Les fichiers sont stockés sous la forme `{ url, publicId, kind }` (kind : image ou pdf).

### User

| Champ | Type | Règles |
|---|---|---|
| firstName, lastName | string | 2–50, nettoyés |
| email | string | unique, en minuscules |
| emailVerifiedAt | Date ou null | — |
| phone | string | unique, E.164 +2135…, +2136… ou +2137… |
| passwordHash | string | bcrypt coût 12, select: false, jamais renvoyé |
| wilayaCode, commune | string | codes de shared/geo |
| bio | string | 500 au maximum |
| avatar | File | facultatif |
| intent | enum | sender, carrier, both |
| accountType | enum | individual, professional ; calculé |
| pro | objet | status (none, pending, approved, rejected, revoked), companyName, legalForm, rcNumber, nif, nis, address, wilayaCode, commune, logo, documents[] (kind, file), submittedAt, reviewedAt, reviewedBy, decisionReason |
| carrierVerification | objet | status (not_submitted, pending, approved, rejected, expired), documents (idFront, idBack, driverLicense, vehicleRegistration, insurance), licenseExpiresAt, insuranceExpiresAt, submittedAt, reviewedAt, reviewedBy, decisionReason |
| vehicles[] | sous-documents | type, brand et plate obligatoires ; model, capacityKg, volumeM3 et photo facultatifs ; isDefault ; 5 au maximum |
| rating | objet | average (1 décimale), count, distribution (de 1 à 5) |
| stats | objet | parcelsPublished, parcelsSent, parcelsCarried, withdrawals, disputesLost, medianReplyMinutes |
| status | enum | active, suspended, pending_deletion, deleted |
| suspension | objet | reason, until, by, at |
| deletionRequestedAt | Date | début du délai de grâce |
| preferences | objet | language (fr, ar), notifications (un booléen par catégorie) |
| blockedUsers[] | ObjectId | — |
| terms | objet | version, acceptedAt |
| lastSeenAt | Date | mis à jour au plus une fois par minute |

Index : email (unique), phone (unique), status, pro.status, carrierVerification.status, wilayaCode.

### StaffAccount

email (unique), firstName, lastName, passwordHash, role (super_admin, moderator), permissions[] (valeurs de shared/permissions.ts), status (invited, active, disabled), totpSecret (chiffré), inviteTokenHash, inviteExpiresAt, invitedBy, lastLoginAt. Un index unique partiel garantit un seul super_admin.

### Parcel

| Champ | Type | Règles |
|---|---|---|
| reference | string | unique, UC-AAMM-NNNN |
| sender | ObjectId User | — |
| title, description | string | 5–80 ; 1 000 au maximum |
| category | enum | voir F6 |
| fragile | boolean | — |
| weightKg | number ou null | 0,1–30 000 ; null en publication rapide |
| dimensionsCm | objet ou null | length, width, height, 1–1 500 ; null en publication rapide |
| volumeM3 | number ou null | calculé |
| vehicleTypes[] | enum | au moins 1 |
| pickup, dropoff | objet | address, details, wilayaCode, commune, location (GeoJSON Point [lng, lat]) |
| distanceKm | number | calculé (Haversine) |
| desiredDate | Date ou null | null : date flexible (publication rapide) |
| timeSlot | enum | morning, afternoon, evening, any |
| desiredTime | string ou null | « HH:mm », facultatif ; impose le créneau correspondant |
| flexibleDates, urgent | boolean | — |
| recipient | objet | name, phone ; visibles par l'expéditeur, et par le transporteur retenu à partir de assigned |
| paymentArrangement | enum | voir F6 |
| requestedPrice, suggestedPrice, finalPrice | number (DA entiers) | finalPrice figé à l'acceptation |
| commission | objet | null si la course est gratuite ; sinon grossPrice, fixedFee, ratePercent, variableCommission, totalCommission, netEarnings, status (pending, charged, refunded, waived), chargedAt. Figée à l'acceptation (F19) |
| photos[] | File | 0–5 |
| status | enum | open, negotiating, assigned, in_transit, delivered_pending, delivered, cancelled, expired, disputed |
| statusHistory[] | objet | from, to, byType (user, staff, system), by, at, reason |
| assignedCarrier, acceptedOffer | ObjectId | null avant acceptation |
| deliveryCode | objet | cipher, attempts, lockedAt |
| deliveryProof | objet | photo, note |
| startedAt, declaredDeliveredAt, deliveredAt, autoConfirmAt, expiresAt | Date | — |
| cancellation | objet | by, reason, at |
| hidden | objet | isHidden, reason, by, at |
| offersCount, viewsCount | number | dénormalisés |

Index : pickup.location et dropoff.location (2dsphere) ; { status, createdAt } ; { sender, status } ; { assignedCarrier, status } ; { pickup.wilayaCode, dropoff.wilayaCode, status } ; index texte sur title, description, pickup.commune et dropoff.commune, avec la langue none et un champ searchText normalisé sans accents.

### Offer

parcel, carrier, vehicle (copie du sous-document véhicule), price (dernier prix proposé par le transporteur), atAskingPrice, proposedPickupDate, status (pending, countered, accepted, rejected, withdrawn, cancelled), rounds[] (by : carrier ou sender, price, at), counterCount (3 au maximum), finalPrice, rejectedBecauseAccepted (booléen, utile pour la réactivation après un désistement).

Index : unique partiel { parcel, carrier } quand status ∈ {pending, countered} ; { carrier, status } ; { parcel, status }.

### Trip et TripRequest

- **Trip** : carrier, from et to (wilayaCode, commune, location), stops[] (wilayaCode, 5 au maximum), departureAt, vehicle, capacityKg, capacityM3, priceHint (mode : flat ou per_kg, amount), recurrence (weekdays[], until), note (300), status (active, full, completed, cancelled), hidden. Index : { from.wilayaCode, to.wilayaCode, departureAt }, { carrier, status }.
- **TripRequest** : trip, parcel, sender, status (pending, offered, declined, expired). Index unique { trip, parcel }.

### Conversation et Message

- **Conversation** : participants[2] (triés), parcel (ou null pour une conversation générale), pairKey (identifiants triés et concaténés), lastMessage (text, type, author, at), unread (dictionnaire userId → nombre), mutedBy[], deletedFor[]. Index unique { pairKey, parcel }, et { participants, lastMessage.at }.
- **Message** : conversation, author (null pour un message système), type (text, image, system), text (2 000), image (File), systemKey et systemParams (pour la traduction), clientId, readBy[] (user, at), deletedByStaff. Index { conversation, createdAt: -1 }, et unique { conversation, clientId }.

### Notification et PushToken

- **Notification** : recipient, type (voir le catalogue), category, titleKey, bodyKey, params (valeurs à insérer dans la traduction), data (parcelId, offerId, tripId, conversationId, disputeId, userId), readAt. Index { recipient, createdAt: -1 }, avec une expiration TTL de 90 jours.
- **PushToken** : user, token (unique), platform (ios, android), deviceId, appVersion, lastUsedAt.

### Review

parcel, author, target, direction (sender_to_carrier ou carrier_to_sender), rating (1–5), criteria (objet de notes de 1 à 5), comment (500), publishedAt (null tant que le double aveugle n'est pas levé), reply (text de 300 caractères au maximum, at), hidden (isHidden, reason, by, at). Index unique { parcel, author } ; index { target, publishedAt }.

### Report et Dispute

- **Report** : reporter, targetType (user, parcel, trip, review, conversation, message), targetId, reason, description (1 000), status (open, resolved, dismissed), staffNote, handledBy, handledAt, claim (by, until). Index unique partiel { reporter, targetType, targetId } quand status = open.
- **Dispute** : parcel, openedBy, against, reason, description (2 000), photos[] (5 au maximum), response (text, photos[], at), status (open, in_review, resolved), outcome (delivered ou cancelled), decisionNote, handledBy, claim, resolvedAt, previousStatus. Un seul litige ouvert par colis.

### Wallet, WalletTransaction et TopUpRequest

- **Wallet** : user (unique), balance (DA, peut être négatif). Le solde ne change que par un $inc atomique accompagné d'une ligne WalletTransaction, dans la même transaction.
- **WalletTransaction** : user, type (welcome_bonus, commission_debit, commission_refund, topup, adjustment), amount (positif pour un crédit, négatif pour un débit), balanceAfter, parcel, topUp, staff, note. Collection en ajout seul ; index unique partiel { user, type } pour welcome_bonus.
- **TopUpRequest** : user, amount, method (ccp, baridimob), reference, proof (File privé), status (pending, approved, rejected), creditedAmount, decisionReason, decidedBy, decidedAt. Index unique partiel { user } quand status = pending.

### Données techniques

- **TrackPoint** : parcel, carrier, location, accuracy, heading, speed, at. Expiration TTL de 30 jours.
- **RefreshToken** : user, tokenHash, familyId, deviceId, deviceName, platform, expiresAt, revokedAt, replacedBy. Expiration TTL à expiresAt.
- **OtpCode** : email, purpose (verify_email, reset_password, change_email), codeHash, attempts, expiresAt (TTL).
- **SavedSearch** : user, name, scope (parcels ou trips), filters, notify, lastNotifiedAt.
- **Favorite** : user, parcel. Index unique sur la paire.
- **AuditLog** : actor (StaffAccount), action (par exemple user.suspend), targetType, targetId, reason, before, after, ip, userAgent. Collection en ajout seul, sans route de modification ni de suppression.
- **AppSetting** : key (unique), value, updatedBy. Clés minimales : pricing, limits (activeParcelsIndividual, activeParcelsPro, activeTripsIndividual, activeTripsPro, maxCounterOffers), autoConfirmHours, parcelExpiryDays, reviewWindowDays, requireCarrierVerification, minAppVersion, maintenance, support (email, WhatsApp), termsVersion, commission (enabled, effectiveFrom, fixedFee, tiers, welcomeBonus, minBalance, topUp : titulaire, CCP, clé, RIP BaridiMob, montants minimal et maximal).
- **Content** : key (faq, terms, privacy), locale (fr ou ar), body (Markdown), version, publishedAt, updatedBy.

### Référentiel géographique

`shared/geo/wilayas.json` contient pour chaque wilaya son code, son nom en français et en arabe, son centre (latitude, longitude) et ses communes (nom en français et en arabe, centre). Le découpage administratif peut évoluer : ce fichier est une donnée versionnée, jamais une liste écrite en dur dans les écrans. Toutes les validations passent par lui.

## API REST et temps réel

L'API utilisateur est servie sous `/api/v1`, et l'API du staff sous `/api/v1/admin` avec un jeton distinct. Chaque corps et chaque paramètre de requête est validé par un schéma zod de shared.

Conventions :

- Authentification par `Authorization: Bearer <accessToken>`. Les routes marquées « public » acceptent une requête sans jeton.
- Erreurs au format `{ "error": { "code": "PARCEL_ALREADY_ASSIGNED", "message": "…", "details": {} } }`. Le code est stable et traduit côté client. Statuts HTTP : 400 validation, 401 non authentifié, 403 interdit, 404 introuvable, 409 conflit d'état, 422 règle métier, 429 trop de requêtes.
- Pagination `?page=1&limit=20` (50 au maximum). Réponse `{ items, page, limit, total, hasMore }`. La messagerie utilise un curseur `?before=<messageId>`.
- Montants en DA entiers, dates en ISO 8601 UTC, coordonnées en `{ lat, lng }` dans l'API et en GeoJSON en base.
- Un fichier OpenAPI est généré depuis les schémas zod et publié en développement sur `/api/v1/docs`.

### Routes utilisateur

| Domaine | Routes | Accès et notes |
|---|---|---|
| Santé et config | GET /health ; GET /app/config | Public |
| Auth | POST /auth/register, /auth/verify-email, /auth/resend-code, /auth/login, /auth/refresh, /auth/logout, /auth/forgot-password, /auth/reset-password | Public, sauf logout. Rate limit renforcé |
| Moi | GET /me ; PATCH /me ; PUT /me/avatar ; PUT /me/password ; POST /me/email-change, /me/email-change/confirm ; PATCH /me/preferences ; GET /me/sessions ; DELETE /me/sessions/:id ; DELETE /me/sessions ; POST /me/push-tokens ; DELETE /me/push-tokens/:token ; POST /me/deletion ; DELETE /me/deletion ; POST /me/terms/accept | Authentifié |
| Statut pro | GET /me/pro ; POST /me/pro (dépôt ou nouveau dépôt) | Authentifié, email vérifié |
| Vérification transporteur | GET /me/carrier-verification ; POST /me/carrier-verification ; GET /me/vehicles ; POST /me/vehicles ; PATCH /me/vehicles/:id ; DELETE /me/vehicles/:id | Authentifié |
| Blocage | GET /me/blocked ; POST /me/blocked/:userId ; DELETE /me/blocked/:userId | Authentifié |
| Portefeuille | GET /me/wallet ; GET /me/wallet/transactions ; GET /me/wallet/topups ; POST /me/wallet/topups ({ amount, method, reference?, proof }) | Authentifié ; recharge réservée aux transporteurs, commission activée |
| Uploads | POST /uploads/signature avec { purpose } (parcel_photo, avatar, message_image, identity_doc, pro_doc, dispute_photo, delivery_proof, vehicle_photo, topup_proof) | Renvoie une signature Cloudinary limitée au dossier, au type et à la taille autorisés pour cet usage |
| Utilisateurs publics | GET /users/:id ; GET /users/:id/reviews ; GET /users/:id/trips | Public, profil filtré |
| Géo | GET /geo/reverse?lat=&lng= ; GET /geo/search?q= | Authentifié ; proxy OpenStreetMap (cache Redis de 7 jours, Nominatim limité à 1 requête par seconde) ou Google (cache de 30 jours) ; repli sur shared/geo |
| Prix | POST /pricing/suggest | Public, même fonction que shared |
| Colis | GET /parcels (filtres et tri de F7) ; GET /parcels/:id ; POST /parcels ; PATCH /parcels/:id ; POST /parcels/:id/duplicate (pro) ; POST /parcels/:id/cancel ; GET /me/parcels?status= | Liste et détail publics ; écriture par le propriétaire |
| Livraison | POST /parcels/:id/start ; POST /parcels/:id/delivery-code ({ code }) ; POST /parcels/:id/declare-delivered ; POST /parcels/:id/confirm-delivery ; POST /parcels/:id/withdraw ; GET /parcels/:id/delivery-code (expéditeur seulement) ; GET /parcels/:id/tracking | Selon F11 et F12 |
| Offres | GET /parcels/:id/offers (expéditeur) ; POST /parcels/:id/offers ; GET /me/offers?tab= ; POST /offers/:id/accept ; /reject ; /counter ; /accept-counter ; /reject-counter ; /reoffer ; /withdraw | Chaque route vérifie l'acteur et l'état |
| Trajets | GET /trips ; GET /trips/:id ; POST /trips ; PATCH /trips/:id ; POST /trips/:id/status ; GET /me/trips ; GET /trips/:id/matching-parcels ; POST /trips/:id/requests ({ parcelId }) ; GET /me/trip-requests ; POST /trip-requests/:id/decline | Écriture réservée au transporteur vérifié propriétaire |
| Favoris | GET /me/favorites ; PUT /me/favorites/:parcelId ; DELETE /me/favorites/:parcelId | Authentifié |
| Alertes | GET /me/saved-searches ; POST ; PATCH /:id ; DELETE /:id | 10 au maximum |
| Messagerie | GET /conversations ; POST /conversations ({ userId, parcelId? }, renvoie l'existante si elle existe) ; GET /conversations/:id ; GET /conversations/:id/messages?before= ; POST /conversations/:id/messages ; POST /conversations/:id/read ; POST /conversations/:id/mute ; DELETE /conversations/:id (pour soi seul) | Participants uniquement |
| Notifications | GET /notifications ; GET /notifications/unread-count ; POST /notifications/:id/read ; POST /notifications/read-all ; DELETE /notifications/:id ; DELETE /notifications | Destinataire uniquement |
| Avis | GET /parcels/:id/review-status ; POST /parcels/:id/reviews ; POST /reviews/:id/reply | Participants du colis livré, dans la fenêtre |
| Signalements | POST /reports | Authentifié |
| Litiges | POST /parcels/:id/disputes ; GET /disputes/:id ; POST /disputes/:id/response | Participants du colis |
| Contenus | GET /content/:key?locale= | Public |

### Routes du staff (/api/v1/admin)

| Domaine | Routes | Permission |
|---|---|---|
| Auth staff | POST /auth/login (mot de passe puis TOTP) ; POST /auth/accept-invite ; POST /auth/refresh ; POST /auth/logout ; GET /me | — |
| Tableau de bord | GET /stats | dashboard.view |
| Consommation Cloudinary | GET /storage-usage | dashboard.view |
| Utilisateurs | GET /users ; GET /users/:id ; POST /users/:id/suspend ; POST /users/:id/reactivate ; DELETE /users/:id | users.view, users.suspend, users.delete |
| Vérifications | GET /verifications/identity ; POST /verifications/identity/:userId/decision ; GET /verifications/pro ; POST /verifications/pro/:userId/decision ; POST /verifications/pro/:userId/revoke ; GET /files/:publicId (URL signée de 5 min) | verifications.identity, verifications.pro |
| Colis et trajets | GET /parcels ; GET /parcels/:id ; POST /parcels/:id/force-status ; POST /parcels/:id/hide ; DELETE /parcels/:id ; GET /trips ; POST /trips/:id/hide ; DELETE /trips/:id | parcels.view, parcels.moderate |
| Litiges | GET /disputes ; GET /disputes/:id ; POST /disputes/:id/claim ; POST /disputes/:id/decision | disputes.handle |
| Signalements | GET /reports ; GET /reports/:id ; POST /reports/:id/claim ; POST /reports/:id/resolve ; POST /reports/:id/dismiss | reports.handle |
| Avis | GET /reviews ; POST /reviews/:id/hide ; DELETE /reviews/:id | reviews.moderate |
| Conversations | GET /conversations ; GET /conversations/:id/messages ; DELETE /messages/:id | conversations.view_reported (avec ?reportId= ou ?disputeId=) ou conversations.view_all |
| Diffusion | POST /broadcasts/preview ; POST /broadcasts ; GET /broadcasts | broadcast.send |
| Contenus | GET /content ; PUT /content/:key/:locale ; POST /content/:key/:locale/publish | content.manage |
| Portefeuilles | GET /wallets/topups?status= ; GET /wallets/topups/:id ; POST /wallets/topups/:id/decision ; GET /wallets?q=&blocked= ; GET /wallets/:userId ; POST /wallets/:userId/adjust | wallet.manage |
| Réglages | GET /settings ; PUT /settings/:key | settings.manage |
| Staff | GET /staff ; POST /staff/invite ; PATCH /staff/:id ; POST /staff/:id/disable ; POST /staff/transfer-super-admin | staff.manage |
| Audit | GET /audit ; GET /audit/export | audit.view |

### Événements Socket.IO

La connexion se fait avec `auth: { token }`. Un jeton absent ou invalide est refusé. Chaque utilisateur rejoint automatiquement sa room `user:<id>`. La reconnexion est automatique, et le client re-synchronise les compteurs à chaque reconnexion. L'adaptateur Redis permet plusieurs instances.

| Événement | Sens | Contenu | Règle |
|---|---|---|---|
| conversation:join, conversation:leave | client → serveur | { conversationId } | Participants seulement |
| message:send | client → serveur | { conversationId, clientId, type, text?, image? } | Accusé avec le message enregistré |
| message:new | serveur → room | message complet | Aussi envoyé à user:<destinataire> pour la liste et le badge |
| typing | client ↔ room | { conversationId, isTyping } | Expire après 3 s côté client |
| conversation:read | client → serveur | { conversationId } | Diffuse messages:read { conversationId, userId, at } |
| notification:new | serveur → user:<id> | notification complète | — |
| counters | serveur → user:<id> | { unreadMessages, unreadNotifications } | À la connexion et à chaque changement |
| parcel:updated | serveur → user:<id> des participants | { parcelId, status, … } | Après chaque transition |
| offer:updated | serveur → expéditeur et transporteur | { offerId, parcelId, status, price } | — |
| tracking:join, tracking:leave | client → serveur | { parcelId } | Expéditeur, transporteur retenu, staff en litige |
| tracking:position | transporteur → serveur | { parcelId, lat, lng, accuracy, heading, speed, at } | Seulement en in_transit ; 1 message toutes les 5 s au maximum |
| tracking:update | serveur → room tracking:<parcelId> | même contenu | — |
| tracking:last | client → serveur, avec accusé | { parcelId } | Renvoie la dernière position depuis Redis |
| session:revoked | serveur → user:<id> | { reason } | Suspension ou déconnexion à distance ; le client se déconnecte |

## Notifications

Chaque événement ci-dessous crée une notification dans l'application et, sauf mention contraire, un push, si la catégorie est active chez le destinataire. Les types sont déclarés dans `shared/notifications.ts`, avec leur catégorie, leurs clés de traduction et leur lien profond.

| Type | Événement | Destinataire | Catégorie | Ouvre |
|---|---|---|---|---|
| offer_received | Nouvelle offre ou nouvelle proposition après contre-offre | Expéditeur | Offres | Offres du colis |
| offer_at_asking_price | Un transporteur accepte le prix demandé | Expéditeur | Offres | Offres du colis |
| counter_offer_received | Contre-offre de l'expéditeur | Transporteur | Offres | Mon offre |
| counter_offer_rejected | Le transporteur refuse la contre-offre | Expéditeur | Offres | Offres du colis |
| offer_accepted | Offre acceptée, ou contre-offre acceptée par le transporteur | Transporteur et expéditeur | Offres | Colis |
| offer_not_selected | Une autre offre a été retenue | Transporteurs concernés | Offres | Colis |
| offer_rejected | Offre refusée par l'expéditeur | Transporteur | Offres | Mon offre |
| offer_withdrawn | Le transporteur retire son offre | Expéditeur | Offres | Offres du colis |
| offer_reactivated | Offre réactivée après un désistement | Transporteurs concernés | Offres | Mon offre |
| parcel_updated | Annonce modifiée alors qu'une offre est active | Transporteurs avec offre active | Offres | Colis |
| parcel_cancelled | Annonce ou livraison annulée par l'expéditeur | Transporteurs avec offre active ou transporteur retenu | Livraisons | Colis |
| carrier_withdrew | Désistement du transporteur retenu | Expéditeur | Livraisons | Colis |
| parcel_expired | Annonce expirée sans transporteur | Expéditeur | Livraisons | Colis, avec bouton Republier |
| delivery_started | Livraison démarrée | Expéditeur | Livraisons | Suivi |
| delivery_declared | Livraison déclarée sans code | Expéditeur | Livraisons | Colis, avec bouton Confirmer |
| delivery_confirm_reminder | Relance à +24 h et +60 h | Expéditeur | Livraisons | Colis |
| delivery_completed | Colis livré (code, confirmation ou validation automatique) | Les deux | Livraisons | Écran de notation |
| delivery_late | Colis en livraison 3 jours après la date souhaitée | Les deux | Livraisons | Colis |
| review_reminder | Avis non laissé à +3 jours | Celui qui n'a pas noté | Livraisons | Écran de notation |
| review_published | Un avis vous concernant est publié | Personne notée | Compte et vérification | Mes avis |
| new_message | Nouveau message (pas de push si la conversation est ouverte à l'écran ou en sourdine) | Destinataire | Messages | Conversation |
| new_listing_match | Nouvelles annonces pour une alerte, regroupées | Propriétaire de l'alerte | Alertes et trajets | Annonces filtrées |
| trip_parcel_match | Un colis correspond à un de vos trajets | Transporteur | Alertes et trajets | Colis |
| nearby_parcel | Nouveau colis près de vous | Transporteur | Alertes et trajets | Colis |
| trip_request_received | Un expéditeur propose son colis sur votre trajet | Transporteur | Alertes et trajets | Colis, avec bouton Faire une offre |
| trip_request_declined | Le transporteur décline la proposition | Expéditeur | Alertes et trajets | Colis |
| favorite_unavailable | Un colis favori est attribué, annulé ou expiré | Utilisateur | Alertes et trajets | Colis |
| identity_approved, identity_rejected, identity_expiring, identity_expired | Décision ou échéance de la vérification transporteur | Transporteur | Compte et vérification | Vérification |
| pro_approved, pro_rejected, pro_revoked | Décision sur le statut pro | Utilisateur | Compte et vérification | Statut pro |
| dispute_opened | Un litige est ouvert contre vous | Autre partie | Livraisons | Litige, avec bouton Répondre |
| dispute_resolved | Décision du staff | Les deux | Livraisons | Litige |
| report_resolved | Votre signalement a été traité (sans détail de la sanction) | Auteur du signalement | Compte et vérification | Aucun écran |
| account_suspended | Suspension (email aussi, pas de push) | Utilisateur | Compte et vérification | — |
| terms_updated | Nouvelle version des CGU | Tous | Compte et vérification | CGU |
| wallet_blocked | Le solde passe sous le seuil (commission prélevée ou ajustement) | Transporteur | Compte et vérification | Mon portefeuille |
| wallet_topup_approved, wallet_topup_rejected | Décision du staff sur une recharge | Transporteur | Compte et vérification | Mon portefeuille |
| broadcast | Message du staff | Segment choisi | Annonces UCOLIS | Lien facultatif |

Les textes sont des clés de traduction avec paramètres, par exemple `notif.offer_received.body` avec `{ carrierName, price, parcelTitle }`. Le serveur construit le push dans la langue enregistrée du destinataire.

## Exigences non fonctionnelles

Toutes ces exigences sont obligatoires dès la v1. Chacune se vérifie par un test ou une mesure.

| Domaine | Exigence |
|---|---|
| Authentification | Jeton d'accès de 15 min et jeton de rafraîchissement rotatif de 30 jours, stocké haché et détecté s'il est rejoué. Mots de passe bcrypt (coût 12). 2FA TOTP pour le staff. Secrets différents pour les jetons utilisateur et staff |
| API | En-têtes Helmet ; CORS limité à CORS_ORIGINS ; corps limité à 1 Mo (les fichiers vont directement sur Cloudinary) ; recherche échappée et limitée à 100 caractères ; aucun opérateur MongoDB accepté dans les entrées (express-mongo-sanitize) |
| Rate limit | Stocké dans Redis, par utilisateur authentifié et non par IP seule : de nombreux abonnés mobiles algériens partagent la même IP publique (CGNAT). 300 requêtes par 15 min et par utilisateur ; 60 par 15 min et par IP pour les routes publiques ; règles d'authentification de F2 ; 30 messages par minute et par utilisateur |
| Autorisations | Chaque route vérifie l'acteur (propriétaire du colis, transporteur retenu, participant) ou la permission staff. Les tests couvrent un accès refusé par route d'écriture |
| Fichiers | Upload signé, limité par usage (type MIME, 10 Mo, dossier). Les pièces d'identité et les justificatifs pro sont en authenticated et servis par URL signée de 5 min, uniquement au staff habilité et au titulaire |
| Intégrité | Machines à états strictes dans shared ; transactions pour les opérations multi-documents ; index uniques pour une offre active par colis, un avis par colis et par auteur, un litige ouvert par colis, un seul super-administrateur |
| Jobs | BullMQ avec plusieurs tentatives et délai croissant : expiration des annonces (toutes les heures), validation automatique, fin des trajets, expiration des pièces (chaque jour), double aveugle des avis, suppression de comptes après le délai de grâce, ménage des anciennes images (réglage mediaRetention : photos d'annonces terminées depuis 90 jours, images de messages de plus de 180 jours, sauf signalement ou litige en cours), push regroupés. Chaque job est idempotent |
| Vie privée | Position partagée seulement en in_transit. Téléphone visible seulement entre les parties d'une livraison. Email et téléphone masqués au staff sans users.view_pii. Accès aux conversations et aux données personnelles journalisés. Conformité visée à la loi algérienne 18-07 sur la protection des données personnelles |
| Permissions de l'appareil | Localisation au premier plan et en arrière-plan, caméra, photos, notifications. Chaque demande est précédée d'un écran explicatif et justifiée par un texte (NSLocationAlwaysAndWhenInUseUsageDescription, etc.) en français et en arabe |
| Temps réel | Position chez l'expéditeur en moins de 15 s ; messages en moins de 1 s sur une bonne connexion ; reconnexion automatique avec re-synchronisation des compteurs et des messages manqués |
| Performance | Liste des annonces affichée en moins de 2 s en 4G ; temps de réponse API p95 < 300 ms hors upload ; listes virtualisées (FlashList) ; images servies redimensionnées par Cloudinary (w_, q_auto, f_auto) |
| Réseau faible | Cache de TanStack Query persisté pour les listes et les détails consultés ; bandeau « Hors connexion » ; file d'envoi des messages rejouée au retour du réseau |
| Disponibilité | API toujours active, GET /health vérifiant MongoDB et Redis ; sauvegardes Atlas quotidiennes conservées 7 jours ; arrêt propre (SIGTERM) avec fin des requêtes en cours |
| Observabilité | Logs JSON corrélés par requestId ; Sentry avec cartes de sources ; alerte si le taux d'erreurs 5xx dépasse 2 % sur 5 min |
| Qualité | TypeScript strict partout ; ESLint et Prettier ; tests de toutes les transitions des machines à états, de la négociation, des permissions staff et du masquage ; couverture ≥ 80 % sur shared et sur les services de l'API ; CI bloquante |
| Internationalisation | Français par défaut, arabe avec bascule RTL complète, anglais pour l'interface (contenus du back-office et noms de lieux en français) (rechargement par Updates.reloadAsync) ; chiffres occidentaux dans les deux langues ; montants affichés « 3 250 DA » et « 3 250 دج » ; dates selon la langue |
| Accessibilité | Cibles tactiles de 44 pt au minimum ; libellés d'accessibilité sur les icônes ; contraste AA ; respect de la taille de police du système jusqu'à 130 % |
| Plateformes | Android 8 et plus, iOS 16.4 et plus, téléphone et tablette, portrait ; Expo SDK 58 ; builds EAS ; mises à jour OTA par canal (preview, production) |
| Stores | Suppression de compte dans l'application ; politique de confidentialité accessible sans compte ; déclaration de localisation en arrière-plan pour Google Play ; questionnaires de confidentialité Apple remplis |

## Design, écrans et i18n

L'interface reste simple et lisible en plein soleil sur un téléphone d'entrée de gamme, avec un thème clair uniquement. Les jetons de design sont définis une fois et repris par le back-office (voir DECISIONS.md : `packages/shared/src/theme.ts`).

| Jeton | Valeur | Usage |
|---|---|---|
| primary | #1A73E8 (bleu) par défaut, réglable par le super-administrateur (réglage branding) ; nuances foncée et claire dérivées | Boutons principaux, prix, onglet actif |
| navy | #0E1B3D (bleu nuit) | Titres, en-têtes, texte principal, carte d'appel de l'accueil |
| accent | #0EA5E9 (bleu ciel), foncé #0369A1, doux #E0F2FE | Badges vérifiés, succès, suivi, point de départ d'un trajet |
| danger | #E5484D | Erreurs, annulation, litige |
| warning | #F5A524 | Urgent, en attente |
| surface | #FFFFFF ; fond #F4F7FC ; gris doux #EEF2F8 (champs, puces, boutons secondaires) | Cartes et fond d'écran |
| Typographie | Inter (latin) et Cairo (arabe) | Tailles 12, 14, 16, 20, 24, 32 |
| Rayons et espacements | Rayons 20 (cartes), 16 (boutons), 14 (champs), 18 (tuiles), 28 (bandeaux et feuilles), 999 (puces) ; espacements par pas de 4 | - |

Composants partagés à construire en premier : Button, TextField, Select (wilaya et commune), Chip, Badge (Pro, Identité, Urgent, Fragile, statut), ParcelCard, TripCard, OfferCard, UserRow (avatar, nom, note, badges), StatusTimeline, EmptyState, ErrorState, Skeleton, BottomSheet, ConfirmDialog, PhotoPicker, MapPicker, PriceInput, RatingStars. La couleur de chaque statut de colis est déclarée une seule fois.

### Écrans mobiles (Expo Router)

```
app/
  _layout.tsx                    fournisseurs : Query, session, langue, socket
  index.tsx                      splash et aiguillage
  update-required.tsx · maintenance.tsx
  onboarding.tsx
  (auth)/login.tsx · register.tsx · register-details.tsx · verify-email.tsx
         forgot-password.tsx · reset-password.tsx · accept-terms.tsx
  (tabs)/_layout.tsx             5 onglets
  (tabs)/home.tsx
  (tabs)/listings.tsx            sélecteur Colis | Trajets, liste et carte
  (tabs)/publish.tsx             choix : publier un colis ou un trajet
  (tabs)/messages.tsx
  (tabs)/profile.tsx
  notifications.tsx
  search/filters.tsx
  parcel/new/route.tsx · details.tsx · options.tsx · photos.tsx · review.tsx
  parcel/[id]/index.tsx · edit.tsx · offers.tsx · make-offer.tsx
  parcel/[id]/tracking.tsx · delivery-code.tsx · declare.tsx · dispute.tsx · review.tsx
  offer/[id].tsx                 détail et négociation
  trip/new.tsx · trip/[id]/index.tsx · trip/[id]/edit.tsx
  conversation/[id].tsx
  user/[id].tsx                  profil public
  dispute/[id].tsx
  report.tsx                     modal générique (type et cible en paramètres)
  me/edit.tsx · password.tsx · email.tsx · parcels.tsx · offers.tsx · trips.tsx
  me/deliveries.tsx · reviews.tsx · favorites.tsx · alerts.tsx · devices.tsx
  me/pro.tsx · carrier-verification.tsx · vehicles.tsx · vehicle/[id].tsx
  me/blocked.tsx · notifications-settings.tsx · language.tsx · delete-account.tsx
  help/index.tsx · help/content/[key].tsx · about.tsx
```

Chaque écran de liste gère 4 états : chargement (squelette), vide (message et action), erreur (message et bouton Réessayer), contenu. Chaque action destructive passe par ConfirmDialog. Chaque formulaire affiche l'erreur sous le champ concerné.

### Écrans du back-office

```
/login · /accept-invite/:token
/                                tableau de bord
/users · /users/:id
/verifications/identity · /verifications/identity/:userId
/verifications/pro · /verifications/pro/:userId
/parcels · /parcels/:id · /trips · /trips/:id
/disputes · /disputes/:id
/reports · /reports/:id
/reviews · /conversations · /conversations/:id
/broadcasts · /content · /settings · /staff · /audit
```

Le menu latéral n'affiche que les pages permises. Il se replie en tiroir sous 768 px.

### Langues et RTL

- Fichiers fr.json et ar.json par espace de noms (common, auth, parcel, offer, trip, chat, notif, errors, profile), partagés entre le mobile et les push du serveur via shared/i18n.
- Aucune chaîne en dur dans les composants. Un test vérifie que les deux fichiers ont exactement les mêmes clés.
- En arabe, `I18nManager.forceRTL(true)` est appliqué puis l'application se recharge. Les icônes directionnelles (flèches, chevrons) sont inversées, et les marges utilisent start et end, jamais left et right.
- Les noms de wilayas et de communes s'affichent dans la langue active depuis shared/geo.
- Les messages d'erreur de l'API sont traduits côté client à partir de error.code.

## Plan de livraison

Le projet se construit en 11 lots successifs. Chacun livre un incrément utilisable de bout en bout. Le lot 6 marque une première version testable par de vrais utilisateurs en bêta fermée, le lot 10 la version soumise aux stores.

| Lot | Contenu | Terminé quand |
|---|---|---|
| 0 — Fondations | Monorepo pnpm et Turborepo ; shared (enums, schémas, wilayas, pricing, machines à états, permissions) ; squelette de l'API (config zod, Mongo, Redis, logs, erreurs, /health) ; squelette Expo Router avec thème, i18n FR/AR et RTL ; squelette du back-office ; CI | pnpm dev lance les trois applications ; la CI passe ; les tests de suggestPrice et des machines à états passent |
| 1 — Comptes | F1 et F2 complets ; F3 sans suppression de compte ; uploads signés ; avatar | Inscription, vérification de l'email, connexion, rafraîchissement silencieux, réinitialisation et suspension testées de bout en bout |
| 2 — Colis | F6 et F7 (sans vue carte ni favoris) ; géocodage par l'API ; profil public | Un colis publié en 4 étapes apparaît dans la liste, filtrable et cherchable ; l'API ignore les prix envoyés par le client |
| 3 — Négociation | F5 (vérification et véhicules, validation manuelle en base en attendant le back-office) ; F8 complet | Les tests de concurrence d'acceptation passent ; toutes les transitions d'offre sont testées |
| 4 — Messagerie et notifications | Socket.IO avec adaptateur Redis ; F13 ; F14 avec push Expo ; bus d'événements et abonnés | Une offre acceptée notifie le transporteur en push et ouvre la conversation ; les badges restent justes après une reconnexion |
| 5 — Livraison et suivi | F11 et F12 ; jobs de validation automatique et d'expiration | Parcours complet d'Amina et Karim sur deux téléphones réels, application du transporteur en arrière-plan |
| 6 — Back-office v1 | Comptes staff, 2FA, invitation, permissions, masquage, audit ; tableau de bord ; utilisateurs ; vérifications identité ; colis ; réglages | Un modérateur « Vérificateur » valide un transporteur et ne voit aucun email en clair ; bêta fermée ouverte |
| 7 — Confiance | F15 ; F16 (signalements et litiges) avec leurs pages du back-office ; avis et conversations côté staff | Un litige ouvert gèle la validation automatique et se tranche depuis le back-office avec notification aux deux parties |
| 8 — Statut pro | F4 ; page Statut pro du back-office ; avantages pro (duplication, limites, export CSV) | Un compte reste particulier tant que le dossier n'est pas validé ; une révocation retire le badge partout |
| 9 — Trajets et alertes | F9 ; F10 ; favoris ; vue carte ; correspondances automatiques regroupées | Les critères d'acceptation de F9 sont couverts par des tests ; un utilisateur ne reçoit jamais plus d'un push par heure et par alerte |
| 10 — Publication | Suppression de compte ; F17 ; diffusion ; contenus ; mise à jour forcée ; accessibilité ; performances ; fiches des stores ; déclarations de confidentialité | Builds de production EAS acceptés par Google Play et l'App Store |

Définition du terminé, valable pour tous les lots :

- [ ] Les règles métier du lot sont appliquées par l'API et couvertes par des tests (accès autorisé, accès refusé, transition interdite).
- [ ] Les textes existent en français et en arabe, et les écrans sont vérifiés en RTL.
- [ ] Les états chargement, vide et erreur sont gérés sur chaque écran du lot.
- [ ] Lint, types et tests passent en CI.
- [ ] Les décisions prises en cours de route sont consignées dans docs/DECISIONS.md.

## Décisions arrêtées et hors périmètre

Les décisions ci-dessous tranchent les points restés ouverts dans la version précédente du produit. Elles s'appliquent sans être rediscutées.

| Sujet | Décision |
|---|---|
| Type de compte | Tout compte est particulier. Le statut professionnel n'existe qu'après validation par le staff d'un dossier de justificatifs |
| Administration | Un super-administrateur unique, créé par script. Il crée des modérateurs aux permissions choisies. Le back-office est une application web séparée, utilisable sur téléphone |
| Vérification des transporteurs | Conseillée, non bloquante par défaut (décision du 25 octobre 2026) : un transporteur non vérifié peut faire une offre et publier un trajet ; il est invité à se faire vérifier et l'expéditeur voit une mention neutre. Le réglage requireCarrierVerification la rend obligatoire |
| Formule de prix | Une seule : le barème de F6 (coût kilométrique par tranches multiplié par un facteur de taille, manutention dégressive par tranches de poids, majoration fragile), dans shared/pricing.ts, recalculé par l'API. Révisée le 29 octobre 2026 pour le pouvoir d'achat algérien, puis le 31 octobre 2026 pour rester sous les tarifs des sociétés de livraison |
| Commission | Gratuit au lancement. Une fois activée par le super-administrateur : 50 DA + taux par tranche du prix convenu, prélevés à la livraison sur un portefeuille prépayé du transporteur, rechargé par virement CCP ou BaridiMob validé par le staff (F19) |
| Notifications push | Branchées dès le lot 4 : collection PushToken, envoi par expo-server-sdk, nettoyage des jetons invalides |
| Réinitialisation du mot de passe | Par code à 6 chiffres saisi dans l'application, sans lien web |
| Dernière position GPS | Gardée dans Redis et historisée par minute dans TrackPoint ; elle survit aux redémarrages |
| Fin de livraison | Code de remise à 4 chiffres, ou déclaration suivie d'une validation par l'expéditeur, automatique au bout de 72 h |
| Annulation après le départ | Impossible ; elle passe par un litige tranché par le staff |
| Conversations | Une par paire d'utilisateurs et par colis, plus une conversation générale par paire |
| Identifiants | Code, champs et valeurs d'enum en anglais ; textes affichés en français et en arabe, et en anglais depuis le 31 octobre 2026 (interface seulement, voir docs/DECISIONS.md) |
| Hébergement | Pas d'offre gratuite qui se met en veille ; API toujours active |

### Hors périmètre de la v1

- Paiement en ligne et séquestre : le prix se règle hors application entre l'expéditeur et le transporteur. Seule la commission UCOLIS passe par l'application (portefeuille prépayé, F19).
- Assurance des colis.
- Calcul d'itinéraire routier réel et estimation d'heure d'arrivée (la distance reste à vol d'oiseau).
- Thème sombre.
- Connexion par téléphone (SMS) ou par réseaux sociaux.
- Suivi par le destinataire sans compte, via une page web publique.
- Points relais et dépôts.
- Application web publique pour les utilisateurs (seul le back-office est web).

### Pistes après la v1

- Paiement électronique (CIB, Edahabia) avec séquestre ; recharge du portefeuille par carte.
- Page de suivi publique pour le destinataire, avec lien partagé.
- Vérification du téléphone par SMS.
- Comptes d'équipe pour les professionnels (plusieurs chauffeurs sous une même entreprise).
- Tarifs négociés et récurrents entre un expéditeur pro et un transporteur.
- Programme de parrainage.
