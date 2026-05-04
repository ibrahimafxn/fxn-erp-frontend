# KPI Raccordement — Règles de calcul

Ce document décrit les règles de calcul des indicateurs de performance raccordement (KPI) affichés sur le tableau de bord Dirigeant. Les données sont issues des fichiers CSV Osiris importés quotidiennement.

> **Règle générale** : Les interventions dont le statut contient ANNUL, CANCELLED ou CANCELED sont exclues de tous les calculs.

---

## KPI 33 — Taux RACC 15J Conquête + Déménagement

| Paramètre        | Valeur                                                  |
|------------------|---------------------------------------------------------|
| **Type**         | RAC                                                     |
| **Objectif**     | > 73 %                                                  |
| **Malus**        | −3 % · Pente 2,5                                        |
| **Bonus**        | +2 % · Pente 2,5                                        |

### Périmètre (dénominateur)
Interventions RACC non annulées dont le type de parcours est **Conquête** ou **Déménagement**.

Source CSV Osiris : colonne **`parcours_types`** (valeurs contenant `CONQUETE` ou `DEMENAGEMENT`).

### Indicateur de succès (numérateur)
Parmi ces interventions, celles qui sont **clôturées avec succès le jour J de l'intervention** (statut `CLOTURE TERMINEE`).

> **Note** : La date de prise de commande n'est pas présente dans le CSV Osiris. En l'absence de cette date, on considère comme succès toute intervention effectivement clôturée lors du passage du technicien.

```
Taux = (clôturées avec succès) / (total Conquête + Déménagement) × 100
```

---

## KPI 34 — Taux RACC 30J Migration

| Paramètre        | Valeur                                                  |
|------------------|---------------------------------------------------------|
| **Type**         | RAC                                                     |
| **Objectif**     | > 60 %                                                  |
| **Malus**        | −3 % · Pente 2,5                                        |
| **Bonus**        | +2 % · Pente 2,5                                        |

### Périmètre (dénominateur)
Interventions RACC non annulées dont le type de parcours est **Migration**.

Source CSV Osiris : colonne **`parcours_types`** (valeur contenant `MIGRATION`).

### Indicateur de succès (numérateur)
Parmi ces interventions, celles qui sont **clôturées avec succès** et dont l'écart entre la **date de RDV** et la **date du 1er RDV** est ≤ 30 jours.

```
Taux = (clôturées succès avec délai ≤ 30 j) / (total Migration) × 100
```

---

## KPI 35 — Taux RECO 15J Prise existante = OUI

| Paramètre        | Valeur                                                  |
|------------------|---------------------------------------------------------|
| **Type**         | RAC                                                     |
| **Objectif**     | > 84 %                                                  |
| **Malus**        | −3 % · Pente 2,5                                        |
| **Bonus**        | +2 % · Pente 2,5                                        |

### Périmètre (dénominateur)
Interventions RACC non annulées de type **RECO / Reconnexion** avec **prise existante = OUI**.

Source CSV Osiris : colonne **`prise_existante`** (valeur `OUI`).

### Indicateur de succès (numérateur)
Parmi ces interventions, celles qui sont **clôturées avec succès** et dont l'écart entre la **date de RDV** et la **date du 1er RDV** est ≤ 15 jours.

```
Taux = (clôturées succès avec délai ≤ 15 j) / (total RECO prise existante OUI) × 100
```

---

## KPI 36 — Taux de R/P au 1er et 2ème RDV non clos à J en échec

| Paramètre        | Valeur                                                  |
|------------------|---------------------------------------------------------|
| **Type**         | RAC                                                     |
| **Objectif**     | > 74 %                                                  |
| **Malus**        | −2 % · Pente 3,3                                        |
| **Bonus**        | +2 % · Pente 3,3                                        |

### Périmètre (dénominateur)
Interventions RACC non annulées répondant aux **deux** conditions suivantes :
- Nombre d'occurrences abonnés sur 90 jours = **1 ou 2 RDV**
- Colonne **`non_clos_pda`** = `KO` (le technicien n'a pas pu clôturer via PDA)

Source CSV Osiris : colonnes **`occurrences_abo_90jours`** et **`non_clos_pda`**.

### Indicateur de succès (numérateur)
Parmi ces interventions "non clos PDA", celles qui sont **clôturées avec succès** (R/P = Raccordé/Planifié réussi).

```
Taux = (non clos PDA clôturées succès) / (total non clos PDA au 1er ou 2ème RDV) × 100
```

---

## KPI 37 — Taux de client non rétablis à J

| Paramètre        | Valeur                                                  |
|------------------|---------------------------------------------------------|
| **Type**         | RAC                                                     |
| **Objectif**     | < 3,5 % (0,035)                                         |
| **Malus**        | −2 % · Pente 0,05                                       |
| **Bonus**        | +1 % · Pente 0,05                                       |

### Périmètre (dénominateur)
**Clients PM distincts** parmi toutes les interventions RACC non annulées.

Un client est identifié de façon unique par la combinaison `(PM/SRO, numéro abonné)`.

Source CSV Osiris : colonnes **`nom_sro`** (ou `sct`) et **`num_abonne`**.

### Indicateur de non-rétablissement (numérateur)
Clients PM distincts qui vérifient les deux conditions suivantes :
1. Colonne **`check_voisinage`** contient `IMPACT` (l'intervention a impacté le voisinage)
2. **Pas de date de clôture hotline** (service toujours interrompu à J), **OU** la date de clôture hotline est **postérieure** à l'heure de début d'intervention (service non rétabli pendant l'intervention)

Source CSV Osiris : colonnes **`check_voisinage`**, **`cloture_hotline`** et **`debut_intervention`**.

```
Taux = (clients PM non rétablis) / (total clients PM distincts) × 100
```

---

## KPI 21 — Taux de note Satisfaction < 6

| Paramètre        | Valeur                                                  |
|------------------|---------------------------------------------------------|
| **Type**         | RAC                                                     |
| **Objectif**     | < 12,5 %                                                |
| **Malus**        | −2 % · Pente 2,5                                        |
| **Bonus**        | +1 % · Pente 2,5                                        |

### Périmètre (dénominateur)
Interventions RACC non annulées avec une **note de satisfaction renseignée** dans les champs Osiris.

Source CSV Osiris : colonne note satisfaction (ex. `note_satisfaction`, `note_client`, `note_csat`).

### Indicateur de succès (numérateur)
Parmi ces interventions, celles dont la note de satisfaction est **strictement inférieure à 6**.

```
Taux = (notes < 6) / (total notes renseignées) × 100
```

---

## Formule d'impact (pente)

Pour chaque KPI, l'impact sur le pourcentage de rémunération est calculé via la formule pente :

```
Malus appliqué  = min(Malus cap,  |écart objectif| / Pente malus)
Bonus appliqué  = min(Bonus cap,  |écart objectif| / Pente bonus)
```

- Si le taux est dans l'objectif → **bonus** (status : vert)
- Si le taux est entre 0 et −5 points de l'objectif → **surveillance** (status : orange)
- Si le taux dépasse −5 points de l'objectif → **malus** (status : rouge)
- Si aucune donnée disponible → **neutre** (status : gris)

L'impact net total = Σ bonus appliqués − Σ malus appliqués.
