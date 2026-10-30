# Illustrations du site UCOLIS : prompts ChatGPT et emplacements

Toutes les images du site sont des **dessins** (illustration vectorielle plate), jamais des photos réalistes.
Chaque fichier se dépose dans `apps/site/public/illustrations/` sous le nom indiqué. Tant qu'un fichier manque, le site affiche à sa place un cadre pointillé portant le nom du fichier attendu.

## Mode d'emploi

1. Ouvrez **une seule conversation** ChatGPT pour toute la série, afin de garder le même style et les mêmes personnages.
2. Collez d'abord le **bloc de style** ci-dessous, tel quel.
3. Envoyez ensuite les prompts un par un, dans l'ordre. Chaque prompt rappelle le style, au cas où vous en génériez un dans une autre conversation.
4. Téléchargez chaque image en PNG, renommez-la exactement comme indiqué, puis déposez-la dans `public/illustrations/`.
5. Si une image contient du texte lisible, demandez « refais la même image sans aucun texte ni lettre ». Les écrans de téléphone ne montrent que des formes abstraites.

## Bloc de style (à coller en premier)

```
Pour toute cette conversation, tu vas me générer une série d'illustrations pour le site web de UCOLIS, une application algérienne de livraison de colis entre particuliers et transporteurs. Respecte toujours ce style :

- Illustration vectorielle plate (flat design 2D) moderne, style « corporate Memphis » adouci, formes arrondies, traits nets, aucune texture photo, aucun rendu 3D réaliste, aucune photo.
- Ombres très douces en aplats, légers dégradés seulement sur les grandes surfaces.
- Palette stricte : bleu de marque #1A73E8, bleu nuit #0E1B3D (contours et vêtements foncés), bleu ciel #0EA5E9, bleu très clair #E8F1FD et #E0F2FE (fonds), orange doux #F5A524 (petits accents seulement), blanc #FFFFFF, gris bleuté #EEF2F8, carton kraft #D9A066 pour les colis. Peaux dans des tons naturels variés.
- Contexte algérien subtil et respectueux : architecture blanche à arcades d'Alger, palmiers, oliviers, collines de l'Atlas, dunes au loin pour le Sud. Personnages modernes, tenues de tous les jours. AUCUN personnage ne porte de foulard, de voile ni de couvre-chef sur les cheveux : les femmes ont les cheveux visibles (attachés, courts, bouclés ou lâchés).
- Personnages récurrents :
  • Amina, 34 ans, cheveux bruns mi-longs attachés en queue de cheval basse, veste bleu clair, petites boucles d'oreilles bleu ciel, sourire chaleureux, expéditrice.
  • Karim, 41 ans, barbe courte poivre et sel, veste bleu nuit, casquette blanche, transporteur.
  • Le fourgon de Karim : fourgon utilitaire blanc avec une bande latérale bleue #1A73E8 et un petit pictogramme de cube blanc sur la bande.
  • Les colis : cartons kraft avec un ruban adhésif bleu #1A73E8.
- Écrans de téléphone : interface claire avec des cartes blanches arrondies, des boutons bleus et des pastilles, mais AUCUN texte, AUCUNE lettre, AUCUN chiffre lisible (seulement des barres arrondies grises qui figurent du texte).
- Aucun logo de marque réelle, aucun drapeau, aucun texte, aucun filigrane.
- Composition aérée, sujet centré, beaucoup d'espace autour.
- Fond TRANSPARENT (PNG) sauf mention contraire.

Réponds juste « OK » et attends mes prompts.
```

## Récapitulatif des emplacements

| N° | Fichier | Section du site | Emplacement précis | Format |
|---|---|---|---|---|
| 1 | `hero.png` | Accueil (haut de page) | À droite du grand titre (à gauche en arabe), sous les cartes flottantes « Nouvelle offre » et « Colis livré » | 3:2, 1536 × 1024, fond transparent |
| 2 | `step-sender-1-publish.png` | Comment ça marche, onglet « J'envoie un colis » | Carte de l'étape 1 « Publiez votre annonce » | 1:1, 1024 × 1024, fond transparent |
| 3 | `step-sender-2-offers.png` | Comment ça marche, onglet expéditeur | Carte de l'étape 2 « Recevez des offres » | 1:1, fond transparent |
| 4 | `step-sender-3-track.png` | Comment ça marche, onglet expéditeur | Carte de l'étape 3 « Suivez en direct » | 1:1, fond transparent |
| 5 | `step-sender-4-handover.png` | Comment ça marche, onglet expéditeur | Carte de l'étape 4 « Confirmez la remise » | 1:1, fond transparent |
| 6 | `step-carrier-1-profile.png` | Comment ça marche, onglet « Je transporte » | Carte de l'étape 1 « Créez votre profil » | 1:1, fond transparent |
| 7 | `step-carrier-2-trip.png` | Comment ça marche, onglet transporteur | Carte de l'étape 2 « Publiez vos trajets » | 1:1, fond transparent |
| 8 | `step-carrier-3-offer.png` | Comment ça marche, onglet transporteur | Carte de l'étape 3 « Faites vos offres » | 1:1, fond transparent |
| 9 | `step-carrier-4-deliver.png` | Comment ça marche, onglet transporteur | Carte de l'étape 4 « Livrez et soyez noté » | 1:1, fond transparent |
| 10 | `simulator.png` | Simulateur de prix | Petite vignette en haut de la carte bleue du résultat, à côté du prix suggéré | 1:1, fond transparent |
| 11 | `trust.png` | Confiance et sécurité | Grande image à gauche (à droite en arabe), entourée des badges « Identités vérifiées » et des étoiles | 1:1, fond transparent |
| 12 | `carriers.png` | Pour les transporteurs | Bandeau au-dessus de la liste des avantages, à côté de la carte « Vos gains » | 3:2, 1536 × 1024, fond transparent |
| 13 | `pro.png` | Comptes professionnels (bloc bleu nuit) | Carte blanche à droite (à gauche en arabe), sous la pastille « Pro vérifié » | 3:2, fond transparent |
| 14 | `persona-amina.png` | Pensée pour la vie de tous les jours | Avatar rond de la 1re carte (Amina) | 1:1, fond plein #E8F1FD |
| 15 | `persona-karim.png` | Pensée pour la vie de tous les jours | Avatar rond de la 2e carte (Karim) | 1:1, fond plein #E0F2FE |
| 16 | `persona-shop.png` | Pensée pour la vie de tous les jours | Avatar rond de la 3e carte (boutique en ligne) | 1:1, fond plein #FEF5E6 |
| 17 | `persona-fleet.png` | Pensée pour la vie de tous les jours | Avatar rond de la 4e carte (SARL de transport) | 1:1, fond plein #EEF2F8 |
| 18 | `faq.png` | Questions fréquentes | Au-dessus des rubriques de la FAQ, colonne de gauche (de droite en arabe) | 1:1, fond transparent |
| 19 | `download.png` | Télécharger l'app (grand bloc bleu dégradé) | À droite des boutons des stores (à gauche en arabe) | 2:3, 1024 × 1536, fond transparent |
| 20 | `og-image.png` | Hors page : aperçu du lien partagé (WhatsApp, Facebook, LinkedIn) | Balise `og:image` de `index.html` | 1536 × 1024 généré, puis recadré en 1200 × 630, fond plein |

## Prompts

### 1. `hero.png`

```
Dans le style défini, illustration principale d'un site web, format paysage 3:2 (1536 × 1024), fond transparent.

Scène : à gauche, Amina, souriante, tend un carton kraft au ruban bleu à Karim, debout à droite devant son fourgon blanc à bande bleue, portes latérales ouvertes, où l'on aperçoit d'autres colis bien rangés. Entre eux, un grand smartphone flotte légèrement incliné : à l'écran, une carte avec un trajet en pointillés bleus entre deux repères (bleu ciel au départ, bleu nuit à l'arrivée) et une carte blanche arrondie figurant une offre, sans aucun texte.

Arrière-plan léger et stylisé en formes plates : silhouette des immeubles blancs à arcades d'Alger et la mer à gauche, une route qui serpente vers des collines de l'Atlas puis des dunes au loin à droite, deux palmiers, quelques nuages arrondis. Une ligne pointillée bleue part du colis et suit la route jusqu'à l'horizon, avec trois petits repères de localisation.

Ambiance optimiste et lumineuse, couleurs de la palette uniquement, beaucoup de blanc. Aucun texte.
```

### 2. `step-sender-1-publish.png`

```
Dans le style défini, illustration carrée 1:1 (1024 × 1024), fond transparent.

Amina, assise en tailleur sur un pouf, tient son smartphone à deux mains et tape avec le pouce. À côté d'elle, un carton kraft au ruban bleu posé au sol. Au-dessus du téléphone flottent, comme sortant de l'écran, trois petites cartes blanches arrondies empilées : la première avec un repère de localisation bleu ciel, la deuxième avec un repère bleu nuit, la troisième avec une pastille bleue figurant un prix. Petites étincelles orange autour pour montrer que c'est rapide. Aucun texte.
```

### 3. `step-sender-2-offers.png`

```
Dans le style défini, illustration carrée 1:1, fond transparent.

Un grand smartphone vu de face, légèrement incliné. De l'écran s'échappent en éventail trois cartes d'offre arrondies, chacune avec un petit avatar rond de transporteur différent (un homme barbu à casquette, une femme aux cheveux courts bouclés, un jeune homme), une rangée de petites étoiles orange et une pastille bleue figurant un prix. La carte du milieu est mise en avant, plus grande, avec un contour bleu #1A73E8 et une coche bleu ciel. La main d'Amina, en bas, s'apprête à la toucher. Aucun texte ni chiffre.
```

### 4. `step-sender-3-track.png`

```
Dans le style défini, illustration carrée 1:1, fond transparent.

Une carte routière stylisée, vue de dessus, en forme de cercle doux : routes blanches, îlots verts pâles, une bande de mer bleu clair en haut. Un trajet en pointillés bleus #1A73E8 relie un repère bleu ciel en bas à droite à un repère bleu nuit en haut à gauche. Au milieu du trajet, le petit fourgon blanc à bande bleue, vu de dessus, avec trois ondes concentriques bleu ciel autour de lui pour montrer le signal GPS en direct. Dans un coin, un smartphone tenu par la main d'Amina affiche la même carte en miniature. Aucun texte.
```

### 5. `step-sender-4-handover.png`

```
Dans le style défini, illustration carrée 1:1, fond transparent.

Devant la porte d'une maison algérienne blanche à arcade, avec un pot de fleurs et un olivier, une destinataire (femme âgée souriante, cheveux gris relevés en chignon, gilet orange doux) reçoit le carton kraft au ruban bleu des mains de Karim. Entre eux flotte une grande bulle arrondie contenant quatre cases carrées vides avec une coche bleu ciel au-dessus (le code de remise, sans chiffres). Quelques confettis bleus et orange. Aucun texte ni chiffre.
```

### 6. `step-carrier-1-profile.png`

```
Dans le style défini, illustration carrée 1:1, fond transparent.

Karim, debout, présente fièrement une grande carte d'identité stylisée (rectangle arrondi avec un portrait simplifié et des barres grises, aucun texte). À côté, un grand badge rond bleu ciel avec une coche blanche, et un petit bouclier bleu #1A73E8. Derrière lui, l'avant de son fourgon blanc à bande bleue. Petites étoiles orange autour du badge. Aucun texte.
```

### 7. `step-carrier-2-trip.png`

```
Dans le style défini, illustration carrée 1:1, fond transparent.

Une route qui serpente en S vue en perspective douce, de bas en haut de l'image, à travers des collines vertes puis des dunes. Sur la route, le fourgon blanc à bande bleue de Karim. Le long de la route, trois repères de localisation : bleu ciel au départ, un petit repère blanc pour l'étape intermédiaire, bleu nuit à l'arrivée. Au-dessus des repères, de petits cartons kraft au ruban bleu flottent avec des lignes pointillées qui les relient à la route, comme s'ils étaient aimantés vers le trajet. Un petit calendrier abstrait (grille sans chiffres) flotte dans le ciel. Aucun texte.
```

### 8. `step-carrier-3-offer.png`

```
Dans le style défini, illustration carrée 1:1, fond transparent.

Karim, assis dans la cabine de son fourgon garé (vue de profil, portière ouverte), tient son smartphone. Au-dessus du téléphone, deux bulles de négociation arrondies alternent : une bulle blanche à gauche et une bulle bleue #1A73E8 à droite, chacune contenant une petite pastille figurant un prix, sans chiffres. Une grande poignée de main stylisée bleu ciel apparaît entre les bulles. Aucun texte ni chiffre.
```

### 9. `step-carrier-4-deliver.png`

```
Dans le style défini, illustration carrée 1:1, fond transparent.

Karim, souriant, debout à côté de son fourgon blanc à bande bleue, porte vide ouverte : la livraison est faite. Il lève le pouce. Au-dessus de lui, cinq grandes étoiles orange #F5A524 en arc de cercle et une jauge circulaire bleue presque pleine (taux de réussite, sans chiffre). Un petit carton kraft vide plié à ses pieds. Confettis bleus. Aucun texte.
```

### 10. `simulator.png`

```
Dans le style défini, illustration carrée 1:1, fond transparent, sujet très lisible même affiché en petit (environ 140 px).

Une balance plate et moderne, bleu nuit et blanche, sur laquelle sont empilés trois cartons kraft au ruban bleu de tailles croissantes (petit, moyen, grand), et une enveloppe blanche posée au sommet. À côté, une grosse pièce ronde bleu ciel et une petite étiquette de prix arrondie orange, sans chiffres. Contours nets, peu de détails, formes larges. Aucun texte.
```

### 11. `trust.png`

```
Dans le style défini, illustration carrée 1:1, fond transparent.

Au centre, un grand bouclier arrondi bleu #1A73E8 avec un dégradé léger vers le bleu ciel, frappé d'une grande coche blanche. Autour du bouclier, en orbite : une carte d'identité stylisée (sans texte), un petit cadenas bleu nuit, une bulle contenant quatre cases carrées vides (code de remise), une rangée de cinq étoiles orange, un petit marteau de juge stylisé, un œil barré pour la vie privée. Les objets sont reliés au bouclier par de fines lignes pointillées bleu clair. Aucun texte.
```

### 12. `carriers.png`

```
Dans le style défini, illustration paysage 3:2 (1536 × 1024), fond transparent.

Karim charge des cartons kraft au ruban bleu dans son fourgon blanc à bande bleue, vu de trois quarts, portes arrière grandes ouvertes, l'intérieur à moitié rempli. À côté, une jeune transporteuse en tenue décontractée bleu nuit pousse un diable chargé de deux cartons vers le fourgon. Au premier plan à droite, un smartphone géant posé debout affiche une carte avec un trajet pointillé et des petits cubes figurant des colis le long du trajet. En arrière-plan stylisé, une station-service simple et des palmiers. Petites pièces de monnaie bleu ciel qui s'envolent du fourgon pour suggérer le revenu. Aucun texte.
```

### 13. `pro.png`

```
Dans le style défini, illustration paysage 3:2, fond transparent.

L'intérieur lumineux d'une petite boutique en ligne algérienne : une gérante (femme d'une trentaine d'années, cheveux attachés, chemise bleu clair) emballe des produits à un grand plan de travail. Sur les étagères derrière elle, des cartons kraft au ruban bleu alignés et étiquetés avec des étiquettes vierges. Un ordinateur portable ouvert affiche un tableau abstrait (lignes et colonnes grises sans texte) avec un grand badge rond bleu à coche. Par la fenêtre, on voit l'avant du fourgon blanc à bande bleue qui attend. Plusieurs colis s'envolent en arc vers la fenêtre, comme une publication en série. Aucun texte.
```

### 14. `persona-amina.png`

```
Dans le style défini, avatar carré 1:1, FOND PLEIN uni bleu très clair #E8F1FD (pas de transparence), cadrage buste centré pour être découpé en cercle.

Amina, 34 ans, cheveux bruns mi-longs attachés en queue de cheval basse, veste bleu clair, petites boucles d'oreilles bleu ciel, sourire chaleureux, regarde vers l'avant. Elle tient contre elle un petit carton cadeau kraft avec un ruban bleu noué en nœud. Visage expressif, style flat simple. Aucun texte.
```

### 15. `persona-karim.png`

```
Dans le style défini, avatar carré 1:1, FOND PLEIN uni bleu ciel très clair #E0F2FE, cadrage buste centré pour être découpé en cercle.

Karim, 41 ans, barbe courte poivre et sel, casquette blanche, veste bleu nuit, sourire assuré, un trousseau de clés à la main. Derrière son épaule, on devine l'avant de son fourgon blanc à bande bleue. Aucun texte.
```

### 16. `persona-shop.png`

```
Dans le style défini, avatar carré 1:1, FOND PLEIN uni orange très clair #FEF5E6, composition centrée pour être découpée en cercle.

Une façade de petite boutique stylisée avec un auvent rayé bleu et blanc, une vitrine contenant des cartons kraft au ruban bleu, et un smartphone posé contre la vitrine. Pas de personnage. Aucun texte, enseigne vierge.
```

### 17. `persona-fleet.png`

```
Dans le style défini, avatar carré 1:1, FOND PLEIN uni gris bleuté #EEF2F8, composition centrée pour être découpée en cercle.

Trois camionnettes blanches à bande bleue garées côte à côte en léger éventail, vues de face et de trois quarts, devant un petit entrepôt bleu nuit à grande porte roulante. Aucun personnage. Aucun texte, aucune plaque lisible.
```

### 18. `faq.png`

```
Dans le style défini, illustration carrée 1:1, fond transparent.

Une conseillère du support souriante (jeune femme aux cheveux noirs au carré, casque audio avec micro, chemise bleu nuit) assise à un bureau avec un ordinateur portable. Autour de sa tête flottent trois bulles de discussion arrondies : une avec un grand point d'interrogation bleu #1A73E8, une avec une coche bleu ciel, une avec trois petits points. Une plante verte sur le bureau. Le point d'interrogation est le seul signe autorisé. Aucun autre texte.
```

### 19. `download.png`

```
Dans le style défini, illustration verticale 2:3 (1024 × 1536), fond transparent. Elle sera posée sur un fond dégradé bleu #1A73E8 → #0EA5E9 : utilise beaucoup de blanc et de bleu nuit pour bien ressortir.

Une main tient un grand smartphone moderne, vu de face, très légèrement incliné. L'écran montre l'accueil d'une application claire : en haut un bandeau bleu nuit arrondi, en dessous deux grosses tuiles arrondies (une bleue avec un pictogramme de colis, une blanche avec un pictogramme de camion), puis deux cartes d'annonce avec une vignette de carton kraft et des barres grises. Autour du téléphone, des cartons kraft au ruban bleu s'envolent en tourbillon avec de petites traînées de vitesse blanches, et deux repères de localisation blancs. Aucun texte, aucune lettre, aucun chiffre à l'écran.
```

### 20. `og-image.png`

```
Dans le style défini, mais cette fois avec un FOND PLEIN (pas de transparence) : image paysage 3:2 (1536 × 1024) destinée à l'aperçu d'un lien partagé sur WhatsApp et Facebook. Elle sera recadrée en 1200 × 630 : garde tout le sujet important dans la bande centrale horizontale et laisse des marges vides en haut et en bas.

Fond en dégradé diagonal du bleu #1A73E8 (en haut à gauche) vers le bleu ciel #0EA5E9 (en bas à droite), avec de grands cercles flous plus clairs. À gauche, un grand pictogramme de cube blanc arrondi (le logo, style ligne épaisse) dans une pastille blanche translucide. Au centre et à droite, le fourgon blanc à bande bleue de Karim roule vers la droite sur une route pointillée blanche, avec trois cartons kraft au ruban bleu sur le toit et des traînées de vitesse. Silhouette blanche très légère des arcades d'Alger en bas à gauche, dunes en bas à droite. Aucun texte.
```

Après génération, recadrez l'image en 1200 × 630 (par exemple avec un éditeur en ligne), puis enregistrez-la sous `og-image.png`.

## Conseils

- **Cohérence** : si un personnage change d'apparence, ajoutez « garde exactement la même Amina (ou le même Karim, le même fourgon) que dans l'image précédente ».
- **Transparence** : si le fond n'est pas transparent, demandez « même image, fond transparent, PNG ». À défaut, un outil de détourage gratuit fait l'affaire.
- **Poids** : avant de déposer les fichiers, compressez-les (TinyPNG ou Squoosh) pour viser moins de 300 Ko par image ; le site les charge à la demande.
- **Arabe** : les images ne contiennent aucun texte, elles servent donc telles quelles dans les deux langues. Seule leur position est inversée en arabe.
