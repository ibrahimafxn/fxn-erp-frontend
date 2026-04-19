# Refonte Import CSV Osiris

## Objectif
Refondre l'import des interventions Osiris pour obtenir un pipeline fiable, déterministe et orienté métier :

- analyse du CSV avant écriture en base
- normalisation forte des lignes
- auto-alimentation des référentiels utiles au tri
- création/versionnement sans perte de données
- tickets pour les cas ambigus
- séparation claire entre `nouvel import`, `historique`, `tickets`

## Hypothèses
- export Osiris réel observé : séparateur `;`, encodage `cp1252`
- clé primaire métier privilégiée : `Num Inter`
- les prestations restent sous contrôle via mapping BPU / Osiris
- les référentiels souples peuvent être auto-créés

## Hors périmètre V1
- suppression automatique d'interventions existantes
- support multi-profils Osiris très différents
- fusion intelligente avancée sans `Num Inter`
- correction automatique de tous les techniciens ambigus

## Priorités
- `P0` indispensable pour une V1 exploitable
- `P1` forte valeur, peut suivre juste après
- `P2` confort / optimisation

---

## Epic 1 — Pipeline backend

### Ticket BE-01 — Créer le modèle `ImportBatch`
**Priorité**: `P0`

**But**
Créer la collection qui représente un import de fichier Osiris.

**À faire**
- créer le schéma `ImportBatch`
- ajouter les statuts : `uploaded`, `analyzed`, `ready`, `blocked`, `committed`, `failed`
- stocker :
  - nom original
  - nom de stockage
  - hash fichier
  - encodage
  - séparateur
  - auteur
  - dates
  - stats
  - résumé preview

**Critères d’acceptation**
- un batch est créé dès upload
- le hash fichier est persisté
- les statuts évoluent correctement pendant le pipeline

**Dépendances**
- aucune

### Ticket BE-02 — Créer le modèle `ImportRow`
**Priorité**: `P0`

**But**
Tracer chaque ligne brute, sa version normalisée et sa décision.

**À faire**
- créer le schéma `ImportRow`
- stocker :
  - `raw`
  - `normalized`
  - `issues[]`
  - `decision`
  - `decisionReason`
  - `dedupeKeyPrimary`
  - `dedupeKeySecondary`

**Critères d’acceptation**
- chaque ligne utile du CSV est retrouvable
- la décision par ligne est consultable après preview

**Dépendances**
- `BE-01`

### Ticket BE-03 — Créer le modèle `ImportTicket`
**Priorité**: `P0`

**But**
Gérer les cas non résolus automatiquement.

**À faire**
- créer le schéma `ImportTicket`
- types :
  - `unknown_technician`
  - `unknown_prestation`
  - `ambiguous_intervention`
  - `invalid_row`
  - `manual_review`
- statuts :
  - `OPEN`
  - `RESOLVED`
  - `IGNORED`

**Critères d’acceptation**
- un ticket peut être créé à partir d’une ligne bloquée
- un ticket garde le contexte utile à la résolution

**Dépendances**
- `BE-02`

### Ticket BE-04 — Créer les référentiels auto-alimentés
**Priorité**: `P0`

**But**
Permettre au serveur d’enrichir automatiquement les filtres à partir des imports.

**À faire**
- créer une collection générique ou plusieurs collections dédiées pour :
  - clients
  - sociétés
  - régions
  - plaques
  - villes
  - gestionnaires infra
  - types logement
  - activités
  - types offre ref
  - types offre lib
  - types pon
  - marques
  - marques gp
  - gem
  - catégories rdv
  - statuts box 4g
- champs :
  - `label`
  - `normalizedKey`
  - `source`
  - `autoCreated`
  - `firstSeenAt`
  - `lastSeenAt`
  - `seenCount`
  - `active`

**Critères d’acceptation**
- une valeur distincte inconnue est créée une seule fois
- les imports suivants réutilisent la même entrée via `normalizedKey`

**Dépendances**
- aucune

### Ticket BE-05 — Implémenter le lecteur CSV Osiris
**Priorité**: `P0`

**But**
Lire l’export Osiris réel observé dans `expo1.csv`.

**À faire**
- créer `OsirisCsvReaderService`
- gérer :
  - encodage `cp1252`
  - séparateur `;`
  - champs quotés
- détecter les colonnes
- remonter une erreur claire si le profil n’est pas compatible

**Critères d’acceptation**
- `expo1.csv` est lu sans corruption d’accents
- le header complet est détecté
- les lignes sont restituées proprement

**Dépendances**
- `BE-01`

### Ticket BE-06 — Implémenter la normalisation métier des lignes
**Priorité**: `P0`

**But**
Transformer une ligne CSV brute en `NormalizedInterventionRow`.

**À faire**
- créer `OsirisRowNormalizerService`
- mapper les champs principaux :
  - `Num Inter`
  - `Commande ID`
  - `Client`
  - `Sociéte`
  - `Région`
  - `Plaque`
  - `Nom Technicien`
  - `Prénom Technicien`
  - `Statut`
  - `Articles`
  - `Liste des prestations réalisées`
  - `Motif Echec`
  - `Echec Niveau 1`
  - `Echec Niveau 2`
  - `Ville`
  - `Gestionnaire Infra`
  - `Nom SRO`
  - `Type operation`
  - `Activite`
  - `Type Offre Ref`
  - `Type Offre Lib`
  - `Type PON`
  - `Marque`
  - `Marque GP`
  - `GEM`
  - `Categorie RDV`
- normaliser :
  - dates
  - texte
  - codes
  - nom complet technicien

**Critères d’acceptation**
- une ligne normalisée exploitable est produite
- les dates sont converties dans un format stable
- `Articles` et `Liste des prestations réalisées` sont extraits en tableaux de codes

**Dépendances**
- `BE-05`

### Ticket BE-07 — Implémenter les règles de validation et d’issues
**Priorité**: `P0`

**But**
Classer les lignes valides, bloquées ou ambiguës.

**À faire**
- créer les `ImportIssueCode`
- vérifier :
  - colonnes obligatoires
  - présence `Num Inter`
  - présence `Date de rdv`
  - dates valides
  - statuts reconnus
  - technicien reconnu / ambigu
  - codes prestations inconnus
  - doublons intra-batch

**Critères d’acceptation**
- chaque ligne a une liste d’issues explicite
- les lignes bloquantes sont identifiées avant commit

**Dépendances**
- `BE-06`

### Ticket BE-08 — Implémenter la synchronisation des référentiels
**Priorité**: `P0`

**But**
Créer automatiquement les nouvelles valeurs distinctes utiles aux filtres.

**À faire**
- créer `InterventionReferentialSyncService`
- extraire les valeurs distinctes du batch
- appliquer la règle :
  - match sur `normalizedKey`
  - sinon auto-create
- incrémenter `seenCount`
- remonter la liste des valeurs créées / existantes

**Critères d’acceptation**
- `SFR GP` importé dans `Client` crée bien une nouvelle entrée si absente
- un second import ne crée pas de doublon sur la même valeur nettoyée

**Dépendances**
- `BE-04`
- `BE-06`

### Ticket BE-09 — Implémenter la preview d’import
**Priorité**: `P0`

**But**
Fournir un résumé exploitable avant écriture des interventions.

**À faire**
- créer le endpoint `GET /interventions/imports/:batchId/preview`
- exposer :
  - total lignes
  - lignes valides / bloquées
  - create / version / skip / ticket estimés
  - colonnes obligatoires manquantes
  - nouvelles valeurs référentielles
  - prestations inconnues
  - techniciens inconnus

**Critères d’acceptation**
- la preview suffit à décider si on peut lancer le commit

**Dépendances**
- `BE-07`
- `BE-08`

### Ticket BE-10 — Implémenter les règles de rapprochement intervention
**Priorité**: `P0`

**But**
Décider si une ligne crée, versionne, ignore ou tickete.

**À faire**
- clé principale : `numInter`
- clé secondaire prudente si besoin :
  - `commandeId + dateRdv + technicianFullName + client`
- règles :
  - pas d’existant -> `create`
  - identique -> `skip`
  - existant modifié -> `version`
  - ambigu -> `ticket`

**Critères d’acceptation**
- le rapprochement est déterministe
- pas d’overwrite destructif

**Dépendances**
- `BE-06`
- `BE-07`

### Ticket BE-11 — Implémenter le commit d’import
**Priorité**: `P0`

**But**
Appliquer réellement les décisions sur la base interventions.

**À faire**
- créer `InterventionImportCommitService`
- créer les interventions nouvelles
- versionner les interventions existantes
- ignorer les doublons stricts
- créer les tickets pour les cas bloqués
- mettre à jour `ImportBatch.commitSummary`

**Critères d’acceptation**
- le commit est idempotent à règles égales
- aucune suppression implicite n’a lieu

**Dépendances**
- `BE-10`

### Ticket BE-12 — Ajouter l’API de tickets
**Priorité**: `P1`

**But**
Permettre la résolution des cas bloqués.

**À faire**
- `GET /interventions/imports/:batchId/tickets`
- `POST /interventions/imports/tickets/:ticketId/resolve`
- gérer :
  - affectation technicien
  - mapping prestation
  - validation manuelle ligne

**Critères d’acceptation**
- un ticket peut être résolu et relancé sans retraiter tout le pipeline

**Dépendances**
- `BE-03`
- `BE-11`

### Ticket BE-13 — Ajouter l’archive et l’historique d’import
**Priorité**: `P1`

**But**
Permettre audit et réouverture des imports passés.

**À faire**
- `GET /interventions/imports`
- `GET /interventions/imports/:batchId`
- `GET /interventions/imports/:batchId/download`
- exposer le fichier brut et les stats de batch

**Critères d’acceptation**
- chaque import passé est consultable
- le CSV original peut être retéléchargé

**Dépendances**
- `BE-01`

---

## Epic 2 — Frontend assistant d’import

### Ticket FE-01 — Remplacer la page actuelle par un assistant d’import
**Priorité**: `P0`

**But**
Ne plus mélanger upload, historique, tickets et analyse dans un seul écran.

**À faire**
- refondre `/admin/interventions/import`
- étapes :
  - fichier
  - analyse
  - nouvelles valeurs détectées
  - blocages
  - validation finale

**Critères d’acceptation**
- un utilisateur comprend le flux sans lire le détail technique

**Dépendances**
- `BE-09`

### Ticket FE-02 — Créer le bloc `Contrôle export`
**Priorité**: `P0`

**But**
Afficher la compatibilité du CSV Osiris avant import.

**À faire**
- montrer :
  - encodage détecté
  - séparateur
  - période détectée
  - colonnes obligatoires
  - volume de lignes

**Critères d’acceptation**
- un CSV non compatible est bloqué visuellement avant commit

**Dépendances**
- `BE-09`

### Ticket FE-03 — Créer le bloc `Nouvelles valeurs détectées`
**Priorité**: `P0`

**But**
Montrer ce qui va enrichir les filtres serveur.

**À faire**
- groupe par référentiel :
  - clients
  - sociétés
  - villes
  - régions
  - etc.
- afficher :
  - nouvelles valeurs créées
  - nombre déjà existant

**Critères d’acceptation**
- l’utilisateur voit immédiatement que `SFR GP` ou une nouvelle ville sera ajoutée

**Dépendances**
- `BE-08`
- `BE-09`

### Ticket FE-04 — Créer le bloc `Prestations inconnues`
**Priorité**: `P0`

**But**
Séparer clairement les référentiels souples des codes prestations à mapper.

**À faire**
- afficher les codes non reconnus
- proposer suggestions si dispo
- CTA vers mapping BPU / tickets

**Critères d’acceptation**
- l’utilisateur sait ce qui bloque vraiment l’import

**Dépendances**
- `BE-09`

### Ticket FE-05 — Créer le bloc `Résumé de décision`
**Priorité**: `P0`

**But**
Afficher ce qui sera créé, versionné, ignoré, ticketé.

**À faire**
- cartes KPI :
  - total
  - create
  - version
  - skip
  - ticket
- tableau filtrable des lignes problématiques

**Critères d’acceptation**
- la décision de commit est compréhensible avant validation

**Dépendances**
- `BE-09`

### Ticket FE-06 — Bouton `Confirmer l’import`
**Priorité**: `P0`

**But**
Déclencher le commit réel après preview.

**À faire**
- appeler `POST /interventions/imports/:batchId/commit`
- afficher progression et résumé final

**Critères d’acceptation**
- l’utilisateur ne commit jamais “à l’aveugle”

**Dépendances**
- `BE-11`

### Ticket FE-07 — Créer la vue `Historique imports`
**Priorité**: `P1`

**But**
Sortir l’historique de la page d’import principale.

**À faire**
- liste des batches
- statut
- auteur
- date
- stats
- téléchargement du CSV
- ouverture preview

**Critères d’acceptation**
- la page historique remplace le bloc “derniers imports” actuel

**Dépendances**
- `BE-13`

### Ticket FE-08 — Créer la vue `Tickets / anomalies`
**Priorité**: `P1`

**But**
Sortir les tickets de correction de la page d’import principale.

**À faire**
- tableau des tickets
- filtres par type / statut / batch
- résolution manuelle

**Critères d’acceptation**
- les tickets sont traitables sans recharger toute la page import

**Dépendances**
- `BE-12`

---

## Epic 3 — Normalisation métier

### Ticket BE-14 — Normaliser les statuts Osiris
**Priorité**: `P0`

**But**
Transformer les statuts bruts en statuts canoniques.

**Règles minimales**
- `CLOTURE TERMINEE` -> `CLOSED_SUCCESS`
- `ECHEC TERMINE` -> `CLOSED_FAILURE`
- `ECHEC` -> `FAILURE`
- autre -> `UNKNOWN`

**Critères d’acceptation**
- les stats import ne dépendent plus de libellés bruts instables

### Ticket BE-15 — Normaliser les techniciens
**Priorité**: `P1`

**But**
Réduire les doublons de techniciens issus d’orthographes variables.

**À faire**
- match exact normalisé
- match prénom/nom inversé
- seuil d’ambiguïté -> ticket

**Critères d’acceptation**
- les cas sûrs sont résolus automatiquement
- les cas douteux ne polluent pas le référentiel

### Ticket BE-16 — Normaliser les motifs d’échec
**Priorité**: `P1`

**But**
Mieux exploiter `Motif Echec`, `Echec Niveau 1`, `Echec Niveau 2`.

**À faire**
- dictionnaire canonique
- conservation du brut
- regroupement analytique

**Critères d’acceptation**
- les dashboards d’échec exploitent des catégories stables

---

## Epic 4 — Tests

### Ticket QA-01 — Jeux de tests parser Osiris
**Priorité**: `P0`

**À faire**
- test encodage `cp1252`
- test séparateur `;`
- test colonnes 120 champs
- test champs quotés

### Ticket QA-02 — Tests normalisation
**Priorité**: `P0`

**À faire**
- statut
- dates
- prestations
- client / société / ville

### Ticket QA-03 — Tests décision create/version/skip/ticket
**Priorité**: `P0`

**À faire**
- intervention nouvelle
- intervention identique
- intervention versionnée
- cas ambigu

### Ticket QA-04 — Tests auto-création référentiels
**Priorité**: `P0`

**À faire**
- création de `SFR GP`
- non-duplication sur second import
- suivi `seenCount`

---

## Ordre de livraison recommandé

### Sprint 1
- `BE-01`
- `BE-02`
- `BE-04`
- `BE-05`
- `BE-06`
- `BE-07`

### Sprint 2
- `BE-08`
- `BE-09`
- `BE-10`
- `FE-01`
- `FE-02`
- `FE-03`

### Sprint 3
- `BE-11`
- `FE-04`
- `FE-05`
- `FE-06`
- `QA-01`
- `QA-02`
- `QA-03`
- `QA-04`

### Sprint 4
- `BE-12`
- `BE-13`
- `FE-07`
- `FE-08`
- `BE-14`
- `BE-15`
- `BE-16`

---

## Définition de fini V1
- un export Osiris réel est uploadé sans erreur d’encodage
- les lignes sont normalisées
- les nouveaux clients / sociétés / villes / etc. sont ajoutés automatiquement
- les prestations inconnues ne sont pas auto-créées
- la preview affiche clairement create/version/skip/ticket
- le commit n’écrase pas destructivement les données existantes
- les cas ambigus ouvrent des tickets

## Fichiers candidats à toucher ensuite

### Front
- `src/app/admin/interventions/interventions-import/*`
- `src/app/core/services/intervention.service.ts`

### Back
- module import interventions Osiris
- modèles import / tickets / référentiels
- service de normalisation
- service de commit

