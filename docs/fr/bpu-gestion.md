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
