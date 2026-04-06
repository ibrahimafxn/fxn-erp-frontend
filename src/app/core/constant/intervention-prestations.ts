import { InterventionRates } from '../services/intervention-rates.service';

export type InterventionPrestationField = {
  key: keyof InterventionRates;
  label: string;
  code: string;
  description: string;
};

export const INTERVENTION_PRESTATION_FIELDS: InterventionPrestationField[] = [
  // ── Raccordements pavillon (scindés en 3 codes) ──────────────────────────────
  {
    key: 'racPavillon',
    label: 'Raccordement pavillon (souterrain)',
    code: 'RAC_PBO_SOUT',
    description: 'Forfait pavillon souterrain.'
  },
  {
    key: 'racAerien',
    label: 'Raccordement pavillon (aérien nacelle)',
    code: 'RAC_PBO_AERIEN',
    description: 'Forfait pavillon aérien avec nacelle obligatoire.'
  },
  {
    key: 'racFacade',
    label: 'Raccordement pavillon (façade nacelle)',
    code: 'RAC_PBO_FACADE',
    description: 'Forfait pavillon façade avec nacelle obligatoire.'
  },
  // ── Raccordement immeuble ────────────────────────────────────────────────────
  {
    key: 'racImmeuble',
    label: 'Raccordement immeuble',
    code: 'RACIH',
    description: 'Forfait immeuble — y compris kit — sans mise en service.'
  },
  // ── PLV PRO ─────────────────────────────────────────────────────────────────
  {
    key: 'racProS',
    label: 'PLV PRO simple',
    code: 'PLV_PRO_S',
    description: 'Plus-value PRO simple B2B FTTH (≤ 100 m tirage intrasite).'
  },
  {
    key: 'racProC',
    label: 'PLV PRO complexe',
    code: 'PLV_PRO_C',
    description: 'Plus-value PRO complexe B2B FTTH (100–220 m tirage intrasite).'
  },
  // ── Mise en service / reconnexion ────────────────────────────────────────────
  {
    key: 'clem',
    label: 'Mise en service',
    code: 'CLEM',
    description: 'Mise en service équipements abonné (TV, Internet, téléphone…).'
  },
  {
    key: 'reconnexion',
    label: 'Reconnexion',
    code: 'RECOIP',
    description: 'Reconnexion immeuble ou pavillon.'
  },
  // ── Fourreaux ────────────────────────────────────────────────────────────────
  {
    key: 'racF8',
    label: 'Fourreau cassé — domaine privé',
    code: 'FOURREAU_CASSE_PRIVE',
    description: 'Réparation-débouchage fourreau — domaine privé.'
  },
  {
    key: 'fourreauBeton',
    label: 'Fourreau cassé — voirie béton/asphalte',
    code: 'FOURREAU_CASSE_BETON',
    description: 'Réparation-débouchage fourreau — voirie asphalte/béton.'
  },
  // ── Réfections ───────────────────────────────────────────────────────────────
  {
    key: 'refrac',
    label: 'Réfection raccordement',
    code: 'REFRAC',
    description: 'Réfection/modification raccordement hors garantie 2 ans.'
  },
  {
    key: 'refcDgr',
    label: 'Réfection dégradation client',
    code: 'REFRAC_DEGRADATION',
    description: "Réfection d'installation suite à dégradation client."
  },
  // ── Déplacements ─────────────────────────────────────────────────────────────
  {
    key: 'deplacementPrise',
    label: 'Déplacement de prise',
    code: 'DEPLACEMENT_PRISE',
    description: "Plus-value déplacement de prise à la demande de l'abonné."
  },
  {
    key: 'deplacementOffert',
    label: 'Déplacement offert',
    code: 'DEPLACEMENT_OFFERT',
    description: "Déplacement offert — cause liée à l'opérateur."
  },
  {
    key: 'deplacementATort',
    label: 'Déplacement à tort',
    code: 'DEPLACEMENT_A_TORT',
    description: 'Déplacement à tort — cause liée au client.'
  },
  // ── SAV ──────────────────────────────────────────────────────────────────────
  {
    key: 'sav',
    label: 'SAV (ancien)',
    code: 'SAV',
    description: 'Code SAV générique conservé pour compatibilité avec les anciens imports.'
  },
  {
    key: 'savExp',
    label: 'SAV EXP',
    code: 'SAV_EXP',
    description: 'Déplacement technicien — non présence OI au RDV.'
  },
  // ── Matériel / équipement ────────────────────────────────────────────────────
  {
    key: 'swapEquipement',
    label: 'Swap équipement',
    code: 'SWAP_EQUIPEMENT',
    description: "Remplacement matériel SFR chez l'abonné (ONT, BOX…) suite défaillance technique."
  },
  {
    key: 'bifibre',
    label: 'Bi-fibre',
    code: 'BIFIBRE',
    description: 'Plus-value raccordement bi fibre (OI AXIONE / ALTITUDE).'
  },
  {
    key: 'nacelle',
    label: 'Nacelle',
    code: 'NACELLE',
    description: 'Mise à disposition nacelle avec chauffeur (accroche câble en hauteur).'
  },
  // ── Câble ────────────────────────────────────────────────────────────────────
  {
    key: 'cableSl',
    label: 'Câble pavillon (au ml)',
    code: 'CABLE_SL',
    description: 'Plus-value longueur câble pavillon au ml (au-delà de 300 m).'
  },
  // ── Divers ───────────────────────────────────────────────────────────────────
  {
    key: 'prestaCompl',
    label: 'Prestation complémentaire',
    code: 'PRESTA_COMPL',
    description: 'Prestation complémentaire facturée en supplément.'
  },
  {
    key: 'demo',
    label: 'Démonstration service',
    code: 'DEMO',
    description: 'Présentation du service au client.'
  },
];
