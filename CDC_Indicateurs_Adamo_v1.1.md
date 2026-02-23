# ADAMO ERP — Module Traçabilité & Conformité
## Cahier des charges enrichi (v1.1) — Février 2026

**Statut**: Draft — À valider

**Auteur**: Direction Technique Adamo

**Destinataires**: Équipe développement, Direction générale, Partenaires opérateurs

**Objet**: Spécification des 5 indicateurs KPI du module Traçabilité & Conformité (version renforcée audit & conformité)

---

## 1. Contexte & Objectifs

### 1.1 Contexte
Adamo ERP est un progiciel de gestion dédié aux sous‑traitants rang 2 de la filière fibre optique. Dans le cadre de son évolution vers les opérateurs de rang 1, Adamo intègre un module « Traçabilité & Conformité » permettant de produire des indicateurs de performance à valeur réglementaire.

Ce module exploite les exports CSV issus du progiciel Osiris de SFR (et équivalents d'autres opérateurs) pour croiser les données d'intervention terrain avec les données RH et de conformité déjà gérées dans Adamo.

### 1.2 Objectifs
- Produire automatiquement 5 indicateurs de performance à partir des données d'intervention importées.
- Générer un rapport mensuel exportable à destination de l’ARCEP, de l’URSSAF et des opérateurs de rang 1.
- Permettre aux opérateurs de justifier la conformité sociale et technique de leur chaîne de sous‑traitance.
- Constituer un avantage concurrentiel différenciant dans le cadre d’une labellisation sectorielle.
- Assurer une traçabilité et une auditabilité de bout en bout des données utilisées dans les rapports.

### 1.3 Sources de données
- **Format source**: CSV Osiris (SFR) — séparateur point‑virgule — encodage ISO‑8859‑1.
- **Fréquence import**: Mensuelle (ou à la demande) — historique conservé par fichier source.
- **Jonction Adamo**: Champ `[Nom Technicien] + [Prénom Technicien] → technicien_id` via table `osiris_mapping`.

### 1.4 Références & cadre (à documenter)
Le module vise à produire des indicateurs compatibles avec les exigences des opérateurs et des autorités de régulation, en particulier sur:
- qualité de service, complétude et délais (référentiels ARCEP),
- conformité sociale des sous‑traitants (URSSAF),
- transparence et traçabilité des interventions.

**Exigence**: chaque KPI devra préciser dans l’annexe la référence de conformité (texte, recommandation ou référentiel interne d’opérateur) utilisée comme base de calcul.

---

## 2. Indicateurs KPI

### 2.1 I‑1 — Taux de Primo‑Résolution (TPR)
**Définition**: proportion d’interventions clôturées avec succès dès le 1er RDV, sans retour technicien.

**Formule**:
```
TPR = (Interventions clôturées au 1er RDV / Total interventions clôturées) × 100
```

**Champs CSV**: `DERNIER_RDV`, `Statut`, `Type`, `Nom Technicien`.

**Règles de gestion**:
- Statut = `CLOTURE TERMINEE` uniquement.
- `DERNIER_RDV`: extraire le 1er entier (regex).
- Exclure `ANNULEE` du dénominateur.
- Ventilation: global, technicien, type d’intervention, zone géographique.

**Seuils**:
- Excellent ≥ 85% — valorisation.
- Acceptable 70–84% — analyse ciblée.
- Insuffisant 55–69% — plan d’action 30 jours.
- Critique < 55% — audit immédiat.

**Valeur réglementaire**: KPI de qualité de déploiement / raccordement. (Référence à préciser en annexe.)

---

### 2.2 I‑2 — Taux de SAV post‑Raccordement (TSR)
**Définition**: proportion de raccordements FTTH ayant généré un SAV dans les 24h.

**Formule**:
```
TSR = (Raccordements avec SAV24 = 1 / Total raccordements clôturés) × 100
```

**Champs CSV**: `SAV24`, `Type`, `Statut`, `Ref PBO`, `Ref. Prise`, `Tech du précédent succès`.

**Règles de gestion**:
- Type = `RACC`.
- `SAV24` = `1` ou vide/`NON`.
- Attribution responsabilité au technicien du raccordement initial via `Tech du précédent succès`.
- TSR élevé par `Ref PBO` → alerte structurelle.

**Seuils**:
- Excellent < 5%
- Acceptable 5–10%
- Insuffisant 10–20%
- Critique > 20%

---

### 2.3 I‑3 — Indice de Conformité Sociale (ICS)
**Définition**: conformité documentaire du technicien et de sa société à la date de chaque intervention.

**Formule**:
```
ICS = (Interventions avec technicien 100% conforme à la date / Total interventions) × 100
```

**Données croisées**:
- Osiris: nom/prénom technicien, date RDV.
- Adamo RH: documents technicien + dates de validité.
- Adamo RH: conformité société (KBIS, URSSAF, RC Pro).

**Règles**:
- Documents obligatoires: habilitation fibre, visite médicale, CIP BTP.
- Société conforme: KBIS < 3 mois, attestation URSSAF < 6 mois, RC Pro valide.
- Document manquant = intervention non vérifiable → non conforme.

**Seuils**:
- Excellent 100%
- Acceptable 95–99%
- Insuffisant 80–94%
- Critique < 80%

**Valeur réglementaire**: preuve URSSAF de conformité chaîne sous‑traitance.

---

### 2.4 I‑4 — Taux d’Occupation Réelle vs Planifiée (TOR)
**Définition**: écart entre horaire planifié et réel, et entre durée planifiée et durée réelle.

**Formules**:
```
Retard moyen = Moyenne(Heure début réelle − Heure RDV planifiée)
Écart durée = Moyenne(Durée réelle − Durée planifiée)
```

**Champs CSV**: `Début`, `Début intervention`, `Durée`, `Cloture Tech`.

**Règles**:
- Inclure uniquement les interventions avec heure réelle renseignée.
- Retard négatif conservé.
- Écart > 60 min = alerte surcharge.

**Seuils**:
- Excellent < 15 min
- Acceptable 15–30 min
- Insuffisant 30–60 min
- Critique > 60 min

**Valeur réglementaire**: indicateur conditions de travail et charge réelle.

---

### 2.5 I‑5 — Indice de Récurrence Abonné (IRA)
**Définition**: abonnés ayant > 2 interventions sur 90 jours, agrégés par PBO/zone.

**Formule**:
```
IRA = # abonnés avec Occurences Abo (90j) ≥ 3
```

**Champs CSV**: `Occurences Abo (90 jours)`, `Ref PBO`, `Code Postal`, `Num Abonné`, `Panne Réseau`.

**Règles**:
- Abonné récurrent = ≥ 3 interventions / 90j.
- Plusieurs récurrents sur même PBO → alerte infrastructure.
- `Panne Réseau = OUI` confirme origine réseau.

**Seuils**:
- Excellent 0–2 PBO
- Acceptable 3–5 PBO
- Insuffisant 6–10 PBO
- Critique > 10 PBO

**Valeur réglementaire**: localisation précise zones réseau dégradées.

---

## 3. Rapport Mensuel de Conformité

### 3.1 Contenu
- Synthèse exécutive (KPIs globaux + évolution vs mois précédent)
- Détail par technicien (TPR, TSR, ICS, TOR)
- Cartographie zones dégradées (IRA + PBO)
- Attestation conformité sociale (URSSAF)

### 3.2 Déclencheurs
- Automatique le 1er du mois à 06:00.
- Manuel (DIRIGEANT / ADMIN).
- Événementiel si seuil critique atteint.

### 3.3 Destinataires & formats
- Direction interne: PDF + Excel détaillé.
- Opérateur rang 1: PDF synthèse + attestation sociale.
- ARCEP (si requis): Excel normalisé (brut KPI).
- URSSAF (si requis): PDF certifié (ICS + liste documents).

---

## 4. Exigences Techniques

### 4.1 Performance
- Calcul KPIs < 30 s pour 10 000 interventions.
- Import CSV ≥ 500 lignes/s.
- Cache Redis TTL 24h, invalidé à nouvel import.

### 4.2 Sécurité & Traçabilité
- Journalisation complète: import, utilisateur, date, volume, hash fichier.
- Pseudonymisation des données personnelles en export tiers.
- Accès module limité DIRIGEANT & ADMIN.

### 4.3 Auditabilité (obligatoire)
- Chaque import reçoit un **hash** (SHA‑256) + horodatage.
- Chaque rapport mensuel conserve la liste des sources (hashes + ids).
- Versioning des règles de calcul.
- Rejouabilité: possibilité de re‑calculer un rapport passé.

### 4.4 Compatibilité
- CSV Osiris (SFR): point‑virgule, ISO‑8859‑1, 1ère ligne = en‑têtes.
- Extensible: Praxedo, Salesforce Field Service, Orange, Bouygues.
- Exports: PDF, Excel, JSON API.

---

## 5. Modèle de données (cible)
- `interventions`
- `prises_reseau`
- `indicateurs_mensuels`
- `rapports_conformite`
- `techniciens_osiris_mapping`
- `audit_imports` (hash, fichier, dates, auteur)

---

## 6. API REST
- `POST /import/csv`
- `GET /indicateurs/:periode`
- `GET /rapports/:id`

**Exigence**: documenter en OpenAPI + versionner les endpoints.

---

## 7. Annexes (à compléter)
- Références réglementaires ARCEP (qualité, complétude, délais).
- Références URSSAF (conformité sous‑traitance).
- Modèle de pseudonymisation (algorithme + clé).
- Politique de conservation des données.

---

© 2026 Adamo ERP — Tous droits réservés
