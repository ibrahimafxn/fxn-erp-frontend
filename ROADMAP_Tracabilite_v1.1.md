# ROADMAP — Module Traçabilité & Conformité (v1.1)
## Planning détaillé (sprints, tâches, backlog)

**Cadence**: sprints de 2 semaines
**Objectif**: MVP en ~2 mois, v1 certifiable en ~4–5 mois

---

## Sprint 0 — Cadrage & conformité (S0)
**Objectif**: verrouiller la crédibilité réglementaire et l’auditabilité

Backlog:
- Annexes réglementaires ARCEP/URSSAF avec références vérifiables.
- Définition du modèle d’audit (hash import, versioning règles, rejouabilité).
- Spéc des exports (PDF/Excel/JSON) + modèle de données cible.
- Définition des seuils KPI (finalisation) + méthode de calcul documentée.

Livrables:
- Annexes finalisées.
- Spéc technique + modèle d’audit validés.

Critères d’acceptation:
- Chaque KPI est traçable à une référence.
- Méthode d’audit approuvée par la direction.

---

## Sprint 1 — Import CSV & stockage (S1)
**Objectif**: ingestion Osiris + stockage stable

Backlog:
- Import CSV ISO‑8859‑1 + séparation point‑virgule.
- Table `osiris_mapping` (technicien).
- Table `interventions` + index clés (date, type, tech, pbo).
- Journal `audit_imports` (hash, taille, user, date).

Livrables:
- Import fonctionnel + persistance données.

Critères d’acceptation:
- Import 10k lignes < 30s.
- Hash import calculé.

---

## Sprint 2 — Calcul KPIs (S2)
**Objectif**: calculer les 5 indicateurs à partir des interventions

Backlog:
- Moteur KPI: TPR, TSR, ICS, TOR, IRA.
- Tables `indicateurs_mensuels`.
- Tests unitaires par KPI (exemples CSV).

Livrables:
- Calculs mensuels reproductibles.

Critères d’acceptation:
- Résultats identiques sur recalcul.
- Temps de calcul < 30s / 10k lignes.

---

## Sprint 3 — Export rapport brut (S3)
**Objectif**: produire un rapport exportable

Backlog:
- Génération PDF + Excel.
- Layout rapport (synthèse + détail).
- API `GET /rapports/:id`.
- Export JSON pour API.

Livrables:
- Rapport mensuel brut.

Critères d’acceptation:
- PDF + Excel générés sans erreur.

---

## Sprint 4 — Dashboard & alertes (S4)
**Objectif**: rendre le module exploitable en production

Backlog:
- Dashboard KPI + seuils.
- Alertes critique automatique.
- Module “attestation conformité sociale”.

Livrables:
- Vue manager + alerting.

Critères d’acceptation:
- Seuils fonctionnels.

---

## Sprint 5 — Auditabilité & conformité (S5)
**Objectif**: preuves auditables

Backlog:
- Versioning des règles de calcul KPI.
- Rejouabilité: recalcul d’un mois passé.
- Hash + signature des rapports.

Livrables:
- “Audit pack” par période.

Critères d’acceptation:
- Recalcul identique.

---

## Sprint 6 — Industrialisation (S6)
**Objectif**: robustesse opérateur rang 1

Backlog:
- Multi‑sources (Praxedo / Salesforce / Orange / Bouygues).
- API OpenAPI + versioning.
- Cache Redis + SLA performance.

Livrables:
- API stable + multi‑sources.

Critères d’acceptation:
- API validée.

---

## Sprint 7 — Pré‑certification & go‑to‑market (S7)
**Objectif**: dossier institutionnel & commercial

Backlog:
- Dossier de conformité (ARCEP/URSSAF) prêt.
- Pack de démonstration (use‑cases).
- KPI comparatifs vs outils concurrents.

Livrables:
- Dossier prêt pour opérateurs.

Critères d’acceptation:
- Validation direction + partenaires.

---

## Risques & dépendances
- Disponibilité des exports opérateurs (Osiris et autres).
- Validation réglementaire (annexes ARCEP/URSSAF).
- Performance en production (taille datasets).

---

© 2026 Adamo ERP — Tous droits réservés
