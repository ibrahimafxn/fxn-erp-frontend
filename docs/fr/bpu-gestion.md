# Gestion du BPU et des prestations

## Objectif

Cette documentation définit la cible fonctionnelle et technique de la gestion des prestations, des prix unitaires, du BPU personnalisé par technicien, ainsi que leur impact sur le calcul du chiffre d'affaires et de l'attachement.

L'objectif est de faire de la liste des prestations saisies par les dirigeants la source unique de vérité pour :

- le catalogue des prestations
- les prix unitaires
- le BPU personnalisé par technicien
- la saisie des prestations réalisées
- le calcul du chiffre d'affaires technicien
- le calcul d'attachement

## Constats sur l'existant

L'existant repose sur plusieurs sources qui se recouvrent :

- `Prestation` : code, désignation, prix
- `BpuEntry` : code, prestation, prix unitaire, segment (`AUTO`, `SALARIE`, `PERSONNALISE`, `AUTRE`)
- `BpuSelection` : sélection et prix unitaire associés à un technicien
- `TechnicianReport` : quantités saisies avec calcul partiellement dépendant du BPU actif

Cette structure crée une ambiguïté : le référentiel métier, le BPU et la saisie opérationnelle portent des données proches mais distinctes. Le calcul du CA est alors fragile, car il peut dépendre du prix courant au lieu du prix réellement appliqué lors de la saisie.

## Principes cibles

Les principes de la future gestion sont les suivants :

- un catalogue maître des prestations est saisi par les dirigeants
- le prix unitaire de base est défini dans ce catalogue
- un technicien peut avoir un BPU personnalisé sans dupliquer tout le catalogue
- la saisie quotidienne enregistre des quantités, pas des prix éditables
- le système résout automatiquement le prix applicable
- un snapshot est figé au moment de la saisie pour préserver l'historique
- le CA et l'attachement sont calculés à partir des données saisies et snapshotées

## Modèle métier cible

### 1. Catalogue des prestations

Le catalogue maître est porté par `prestation_catalog`.

```ts
type PrestationCatalog = {
  id: string;
  code: string;
  libelle: string;
  segment: 'AUTO' | 'SALARIE' | 'PERSONNALISE' | 'AUTRE';
  famille?: string;
  unite?: string;
  prixUnitaireBase: number;
  active: boolean;
  visiblePourSaisie: boolean;
  compteDansCa: boolean;
  compteDansAttachement: boolean;
  coefficientCa: number;
  coefficientAttachement: number;
  ordreAffichage: number;
  dateEffet?: string;
  createdAt: string;
  updatedAt: string;
};
```

Rôle :

- définir le référentiel unique
- porter le prix unitaire de base
- porter les règles métier globales

### 2. Affectation des prestations

L'accès aux prestations est géré par `prestation_assignment`.

```ts
type PrestationAssignment = {
  id: string;
  prestationId: string;
  ownerType: 'GLOBAL' | 'SEGMENT' | 'TECHNICIAN';
  ownerId?: string | null;
  active: boolean;
  ordre?: number;
  createdAt: string;
  updatedAt: string;
};
```

Rôle :

- dire quelles prestations sont proposées à quels utilisateurs
- piloter la visibilité sans porter le prix

### 3. BPU personnalisé par technicien

Le BPU personnalisé est porté par `prestation_technician_override`.

```ts
type PrestationTechnicianOverride = {
  id: string;
  technicianId: string;
  prestationId: string;
  enabled?: boolean | null;
  prixUnitaireOverride?: number | null;
  coefficientCaOverride?: number | null;
  coefficientAttachementOverride?: number | null;
  ordreAffichageOverride?: number | null;
  createdAt: string;
  updatedAt: string;
};
```

Rôle :

- personnaliser le prix unitaire d'une prestation pour un technicien donné
- masquer une prestation pour un technicien, même si elle est globale
- ajuster les coefficients ou l'ordre d'affichage sans recréer la prestation

Ce modèle évite de dupliquer tout le catalogue par technicien.

### 4. Rapport technicien

Le rapport journalier reste porté par `technician_report`.

```ts
type TechnicianReport = {
  id: string;
  technicianId: string;
  dateActivite: string;
  commentaire?: string;
  totalCa: number;
  totalAttachement: number;
  status: 'DRAFT' | 'VALIDATED';
  createdAt: string;
  updatedAt: string;
};
```

### 5. Lignes snapshotées

Les lignes réellement calculées doivent être stockées dans `prestation_entry`.

```ts
type PrestationEntry = {
  id: string;
  reportId: string;
  technicianId: string;
  prestationId: string;
  codeSnapshot: string;
  libelleSnapshot: string;
  segmentSnapshot: string;
  prixUnitaireSnapshot: number;
  quantite: number;
  montantLigne: number;
  compteDansCaSnapshot: boolean;
  compteDansAttachementSnapshot: boolean;
  coefficientCaSnapshot: number;
  coefficientAttachementSnapshot: number;
  totalCaLigne: number;
  totalAttachementLigne: number;
  createdAt: string;
};
```

Rôle :

- figer la réalité métier appliquée au moment de la saisie
- empêcher qu'un changement de prix ultérieur modifie les historiques

## Résolution du BPU effectif

Le BPU affiché au technicien n'est pas un référentiel autonome. C'est une vue résolue à partir de trois couches :

1. catalogue maître
2. assignments applicables
3. overrides du technicien

Ordre de résolution :

1. charger les prestations actives du catalogue
2. filtrer selon les affectations applicables
3. appliquer les overrides du technicien
4. produire le BPU effectif final
5. figer cette version lors de la création du report

Priorité des valeurs :

- prix unitaire override si présent
- sinon prix unitaire de base du catalogue

## Règles métier

### Catalogue

- le code prestation doit être unique
- une prestation inactive n'est plus proposée en saisie
- une prestation inactive reste visible dans l'historique

### BPU personnalisé

- le prix personnalisé remplace le prix de base pour le technicien concerné
- l'absence d'override signifie héritage du catalogue
- `enabled = false` peut masquer une prestation pour un technicien

### Calcul du chiffre d'affaires

Pour chaque ligne :

- `montantLigne = quantite × prixUnitaireSnapshot`
- `totalCaLigne = montantLigne × coefficientCaSnapshot` si `compteDansCaSnapshot = true`

Total report :

- `totalCa = somme(totalCaLigne)`

### Calcul d'attachement

Même principe :

- `totalAttachementLigne = montantLigne × coefficientAttachementSnapshot` si `compteDansAttachementSnapshot = true`
- `totalAttachement = somme(totalAttachementLigne)`

### Historique

- l'historique ne doit jamais être recalculé depuis le prix courant du catalogue
- les dashboards doivent lire les snapshots du report

## Écrans cibles

### 1. Catalogue prestations dirigeants

Page centrale de référence.

Fonctions :

- créer une prestation
- modifier une prestation
- activer ou désactiver une prestation
- définir le prix unitaire de base
- définir les règles de CA et d'attachement
- ouvrir la personnalisation par technicien

Colonnes recommandées :

- code
- libellé
- segment
  valeurs cibles : `AUTO`, `SALARIE`, `PERSONNALISE`, `AUTRE`
- famille
- prix unitaire de base
- compte dans CA
- compte dans attachement
- statut actif

### 2. BPU technicien

Page dédiée à la personnalisation du BPU par technicien.

Fonctions :

- sélectionner un technicien
- voir les prestations héritées du catalogue
- activer ou masquer des prestations
- personnaliser le prix unitaire
- personnaliser des coefficients si nécessaire
- réinitialiser les overrides

Colonnes recommandées :

- visible
- code
- libellé
- prix base
- prix personnalisé
- CA hérité/personnalisé
- attachement hérité/personnalisé
- ordre

### 3. Saisie technicien

Page opérationnelle de saisie.

Fonctions :

- afficher uniquement le BPU effectif du technicien
- saisir les quantités
- afficher le prix appliqué en lecture seule
- calculer automatiquement les montants de ligne
- calculer le total CA
- calculer le total attachement
- sauvegarder un brouillon
- valider un report

### 4. Historique technicien

Fonctions :

- afficher les prestations réellement saisies
- afficher quantités, prix appliqué, montant ligne
- afficher total CA et total attachement

### 5. Dashboards CA / attachement

Fonctions :

- agréger par technicien
- agréger par période
- agréger par segment
- pour le chiffre d'affaires technicien, utiliser le segment `PERSONNALISE` comme base de résolution du BPU effectif
- lire les données snapshotées

## API cible

### Catalogue

- `GET /prestations-catalog`
- `POST /prestations-catalog`
- `GET /prestations-catalog/:id`
- `PUT /prestations-catalog/:id`
- `PATCH /prestations-catalog/:id/status`

### Assignments

- `GET /prestation-assignments?ownerType=&ownerId=`
- `POST /prestation-assignments`
- `PUT /prestation-assignments/bulk`

### Overrides technicien

- `GET /technicians/:id/prestation-overrides`
- `PUT /technicians/:id/prestation-overrides/bulk`
- `PATCH /technicians/:id/prestation-overrides/:overrideId`
- `DELETE /technicians/:id/prestation-overrides/:overrideId`

### BPU effectif

- `GET /technicians/:id/effective-bpu`

Exemple de retour :

```ts
type EffectiveBpuItem = {
  prestationId: string;
  code: string;
  libelle: string;
  segment: string;
  prixUnitaire: number;
  compteDansCa: boolean;
  compteDansAttachement: boolean;
  coefficientCa: number;
  coefficientAttachement: number;
  ordreAffichage: number;
  source: 'CATALOG' | 'OVERRIDE';
};
```

### Reports

- `GET /technician-reports`
- `GET /technician-reports/:id`
- `POST /technician-reports`
- `PUT /technician-reports/:id`
- `DELETE /technician-reports/:id`
- `GET /technician-reports/summary`
- `GET /technician-reports/summary-by-month`

Payload de création recommandé :

```ts
type CreateReportPayload = {
  dateActivite: string;
  commentaire?: string;
  entries: Array<{
    prestationId: string;
    quantite: number;
  }>;
};
```

Le backend doit :

- résoudre le BPU effectif
- construire les snapshots
- calculer les totaux
- renvoyer le report enrichi

## Migration depuis l'existant

### Sources actuelles

- `Prestation` : code, désignation, prix
- `BpuEntry` : code, prestation, prix unitaire, segment
- `BpuSelection` : sélection et prix spécifiques par technicien
- `TechnicianReport` : saisie des quantités

### Règles de fusion

Clé métier principale :

- `code`

Priorités recommandées :

- libellé : `Prestation.designation`, sinon `BpuEntry.prestation`
- prix de base : `Prestation.prix`, sinon `BpuEntry.unitPrice`
- segment : `BpuEntry.segment`
- règle métier : les reports technicien calculent le CA à partir du segment `PERSONNALISE`

Si plusieurs lignes partagent le même code avec des prix ou libellés différents :

- produire une liste d'anomalies
- ne rien écraser silencieusement

### Migration des personnalisations

Chaque `BpuSelection` doit être convertie en :

- assignment pour la visibilité
- override si le prix diffère du prix de base

Règle :

- si `unitPrice` est identique au prix catalogue, aucun override n'est nécessaire
- si `unitPrice` diffère, créer un override explicite

### Migration des reports

Stratégie recommandée :

- conserver la lecture compatible des anciens reports
- écrire les nouveaux reports avec snapshots complets
- éviter dans un premier temps une migration rétroactive massive des historiques

## Ordre de développement recommandé

### Backend

1. créer les nouvelles entités et schémas
2. créer l'endpoint `effective-bpu`
3. adapter la création de report avec snapshot
4. créer les endpoints catalogue, assignments et overrides
5. adapter les summaries CA et attachement sur les snapshots
6. conserver une lecture compatible des anciens reports

### Frontend

1. refondre les modèles métier côté front
2. créer la page `Catalogue prestations`
3. créer la page `BPU technicien`
4. brancher la saisie technicien sur le BPU effectif
5. adapter l'historique technicien
6. adapter les dashboards CA / attachement
7. retirer progressivement les anciens écrans redondants

## Décisions à valider avant développement

Les points suivants doivent être figés :

1. le code prestation est-il unique globalement
2. le prix personnalisé remplace-t-il totalement le prix de base
3. une prestation globale peut-elle être masquée pour un technicien
4. le calcul doit-il intervenir dès la sauvegarde ou uniquement à la validation
5. faut-il gérer des statuts `DRAFT` et `VALIDATED`
6. qui peut modifier un report validé

## Recommandations

Les recommandations de cadrage sont :

- code prestation unique globalement
- override technicien prioritaire sur le prix catalogue
- possibilité de masquer une prestation pour un technicien
- calcul au moment de la sauvegarde
- statuts `DRAFT` puis `VALIDATED`
- modification d'un report validé réservée à un rôle dirigeant ou admin avec traçabilité

## Prochaine tranche à lancer

Pour lancer la mise à jour sans casser l'existant, la prochaine tranche de travail recommandée est :

1. stabiliser le contrat métier des nouvelles entités
2. implémenter les endpoints backend du catalogue et du BPU effectif
3. adapter la page de saisie technicien pour consommer le BPU effectif
4. faire écrire les snapshots à la création des reports
5. basculer ensuite les dashboards sur ces snapshots

Cette séquence limite les régressions et permet une transition progressive.

## Chantier frontend lancé

Le frontend a été préparé avec un socle non destructif pour accompagner la bascule future du backend.

Éléments ajoutés :

- modèles de catalogue des prestations
- modèles de BPU effectif technicien
- types enrichis pour les reports snapshotés
- service frontend pour le catalogue cible
- service frontend pour l'endpoint `effective-bpu`

Fichiers de socle ajoutés ou enrichis :

- `src/app/core/models/prestation-catalog.model.ts`
- `src/app/core/models/effective-bpu.model.ts`
- `src/app/core/services/prestation-catalog.service.ts`
- `src/app/core/services/effective-bpu.service.ts`
- `src/app/core/services/technician-report.service.ts`

Ce socle n'a pas encore remplacé les écrans existants. Il prépare :

- la future page catalogue dirigeants
- la future page BPU technicien
- la saisie technicien branchée sur le BPU effectif
- les reports snapshotés

### Étape suivante de code

La prochaine implémentation concrète côté frontend consiste à :

1. brancher la page de saisie technicien sur `EffectiveBpuService`
2. afficher le prix appliqué et le montant de ligne
3. envoyer des entrées `prestationId + quantite`
4. conserver un fallback temporaire sur l'ancien format tant que le backend n'est pas basculé

## Priorités UX

Les priorités ergonomiques identifiées à ce stade sont les suivantes :

1. simplifier `/admin/bpu` en séparant plus clairement le choix du contexte et la modification de la grille
2. rendre l'action principale plus évidente sur chaque écran métier
3. réduire la charge cognitive sur mobile, surtout sur les vues admin
4. uniformiser les termes métier dans toute l'application

Ces priorités doivent guider les prochaines retouches UI avant les refontes plus profondes.

## Audit UX concret

### Synthèse

Le produit est visuellement cohérent et déjà crédible en usage réel. La principale faiblesse ne vient pas du style graphique, mais de la densité métier sur certains écrans admin, où plusieurs intentions sont encore mélangées.

### `/admin/bpu`

Points bons :

- l'écran donne une vue riche sur le BPU, les personnalisations et les techniciens concernés
- la présence du segment, du technicien ciblé et des prestations dans une seule page est efficace pour un utilisateur expert
- les blocs `Techniciens avec BPU personnalisé actif` et `Techniciens rattachés au segment` apportent du contexte utile

Points gênants :

- la page mélange sélection de contexte, édition du catalogue, personnalisation technicien et affectation
- l'utilisateur doit comprendre plusieurs concepts avant d'agir : segment, global, personnalisé, technicien ciblé, héritage
- l'action principale varie selon le contexte mais la structure de l'écran reste presque identique
- le mot `Segment catalogue` n'est pas immédiat pour un nouveau dirigeant

Priorités de correction :

- séparer visuellement la zone `Contexte` de la zone `Prestations`
- afficher un résumé d'état plus direct, par exemple `Vous éditez le BPU PERSONNALISÉ de X`
- renommer ou expliciter `Segment catalogue`
- réduire les actions concurrentes visibles en même temps

### `/admin/prestations`

Points bons :

- l'idée de référentiel central est claire
- la page correspond bien au rôle dirigeant
- la structure liste + formulaire fonctionne bien pour la maintenance courante

Points gênants :

- la différence entre prestation catalogue et BPU n'est pas encore toujours évidente selon les libellés
- certains champs métier ont le même poids visuel alors qu'ils n'ont pas la même importance

Priorités de correction :

- faire ressortir plus fortement `code`, `libellé`, `prix unitaire` et `segment`
- placer les règles avancées dans une zone secondaire
- ajouter un court texte d'aide sur le rôle du catalogue dans les calculs

### `/technician/reports`

Points bons :

- la page est orientée tâche et le technicien comprend rapidement quoi saisir
- l'ajout du prix appliqué et du montant de ligne améliore fortement la confiance
- le lien entre saisie et CA devient visible

Points gênants :

- quand la liste des prestations est longue, la lecture devient vite dense
- la différence entre quantité, prix unitaire et montant peut rester trop compacte sur petit écran

Priorités de correction :

- rendre les totaux et sous-totaux plus visibles pendant la saisie
- mieux espacer les lignes sur mobile
- mettre en avant les prestations déjà renseignées

### `/admin/technicians/activity`

Points bons :

- le tableau permet une lecture rapide de l'historique
- les filtres de période, technicien et dépôt répondent bien au besoin métier
- le bloc `Montant` en tête donne un repère utile

Points gênants :

- la page donne beaucoup d'information tabulaire sans guider la lecture
- la zone de filtres et la table ont un poids visuel proche
- l'absence de filtre technicien n'était pas évidente dans la lecture du total

Priorités de correction :

- mieux distinguer `filtres`, `résumé`, `résultats`
- ajouter un libellé plus explicite quand le total affiché concerne tous les techniciens
- alléger la table sur mobile en repliant certaines colonnes secondaires

### `/technician`

Points bons :

- le dashboard technicien est clair et rassurant
- les cartes journalier, hebdomadaire et mensuel sont lisibles
- les accès rapides couvrent bien les usages récurrents

Points gênants :

- certains modules secondaires ont presque le même poids que le CA
- la lecture de l'import du jour est correcte mais un peu dense sur petit écran

Priorités de correction :

- renforcer encore la hiérarchie entre CA, import et raccourcis
- condenser les métadonnées d'import sur mobile

### `/technician/documents`

Points bons :

- la page est simple et compréhensible
- l'action principale `Recharger` est bien visible

Points gênants :

- l'état vide, l'état erreur et la liste de documents restent assez proches visuellement
- quand un document est indisponible, l'utilisateur ne sait pas toujours si le problème vient du fichier ou du réseau

Priorités de correction :

- différencier plus nettement les états de la page
- proposer des messages plus orientés action quand un document doit être réimporté

## Ligne directrice UX

La ligne directrice recommandée pour la suite est simple :

- une page = une intention principale
- un vocabulaire métier unique
- un niveau de priorité visuelle clair
- moins d'actions concurrentes sur les écrans admin
- une lecture mobile pensée comme un vrai parcours, pas comme une simple réduction du desktop

## Plan d'amélioration UX priorisé

### Lot UX-01

Objectif :

- clarifier `/admin/bpu` sans changer le modèle métier

Tickets :

- `UX-01-01` Créer une vraie zone `Contexte` en haut de page avec `segment`, `technicien`, `statut de personnalisation`
- `UX-01-02` Ajouter un bandeau d'état du type `Vous modifiez le BPU PERSONNALISÉ de X`
- `UX-01-03` Renommer les libellés ambigus
  cible :
  `Segment catalogue` -> `Segment source`
  `Configuration par défaut` -> `BPU par défaut`
- `UX-01-04` Réduire la concurrence visuelle entre `copier`, `supprimer`, `modifier`, `enregistrer`
- `UX-01-05` Améliorer la version mobile de `/admin/bpu` en séparant filtres et tableau

Impact attendu :

- baisse de la charge cognitive
- meilleure compréhension du contexte courant
- moins d'erreurs de manipulation

### Lot UX-02

Objectif :

- rendre la saisie technicien plus fluide et plus lisible

Tickets :

- `UX-02-01` Mettre davantage en avant le total courant pendant la saisie
- `UX-02-02` Faire ressortir les prestations déjà renseignées
- `UX-02-03` Augmenter l'espacement et la lisibilité des lignes sur mobile
- `UX-02-04` Ajouter un résumé compact `quantité totale / montant estimé`
- `UX-02-05` Uniformiser les libellés `prix appliqué`, `montant ligne`, `total CA`

Impact attendu :

- meilleure vitesse de saisie
- baisse des erreurs de lecture
- compréhension plus directe du calcul

### Lot UX-03

Objectif :

- améliorer les vues d'historique et d'analyse admin

Tickets :

- `UX-03-01` Séparer visuellement `filtres`, `résumé`, `résultats` dans `/admin/technicians/activity`
- `UX-03-02` Expliciter le sens du total quand aucun technicien n'est sélectionné
- `UX-03-03` Alléger la table sur mobile en repliant les colonnes secondaires
- `UX-03-04` Ajouter des libellés de contexte sur la période active
- `UX-03-05` Rendre les montants plus saillants que les métadonnées secondaires

Impact attendu :

- lecture plus rapide
- meilleure compréhension du périmètre affiché
- confort amélioré sur petit écran

### Lot UX-04

Objectif :

- renforcer la clarté du référentiel prestations

Tickets :

- `UX-04-01` Mettre en avant les champs structurants du catalogue : `code`, `libellé`, `prix`, `segment`
- `UX-04-02` Déplacer les règles avancées dans une section secondaire ou repliable
- `UX-04-03` Ajouter un texte d'aide expliquant le rôle du catalogue dans le calcul du CA
- `UX-04-04` Harmoniser les termes entre catalogue, BPU et report
- `UX-04-05` Vérifier la cohérence des termes entre admin et technicien

Impact attendu :

- meilleure compréhension de la source de vérité
- moins de confusion entre catalogue et BPU

### Lot UX-05

Objectif :

- améliorer les états système et messages d'aide

Tickets :

- `UX-05-01` Différencier plus nettement les états `vide`, `chargement`, `succès`, `erreur`
- `UX-05-02` Rendre les messages d'erreur plus orientés action
- `UX-05-03` Ajouter des messages de confirmation plus contextuels après sauvegarde
- `UX-05-04` Réduire les erreurs génériques au profit de messages métier
- `UX-05-05` Uniformiser le ton des feedbacks dans toute l'application

Impact attendu :

- moins d'ambiguïté
- meilleure autonomie utilisateur

## Ordre recommandé de mise en oeuvre UX

1. `UX-01` `/admin/bpu`
2. `UX-03` `/admin/technicians/activity`
3. `UX-02` `/technician/reports`
4. `UX-04` `/admin/prestations`
5. `UX-05` états globaux et messages

## Règle d'exécution

Pour chaque lot UX :

- commencer par une correction faible risque de structure et de wording
- vérifier le rendu mobile et desktop
- ne pas mélanger refonte fonctionnelle et retouche ergonomique dans le même ticket
- mesurer si l'écran devient plus lisible avant d'ajouter de nouvelles actions
