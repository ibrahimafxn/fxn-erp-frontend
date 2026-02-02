import { InterventionRates } from '../services/intervention-rates.service';

export type InterventionPrestationField = {
  key: keyof InterventionRates;
  label: string;
  code: string;
  description: string;
};

export const INTERVENTION_PRESTATION_FIELDS: InterventionPrestationField[] = [
  {
    key: 'racPavillon',
    label: 'Raccordement pavillon',
    code: 'RACPAV',
    description: 'Insertion d’un raccordement dans un logement individuel.'
  },
  {
    key: 'cablePav1',
    label: 'Câble pavillon tranche 1',
    code: 'CABLE_PAV_1',
    description: 'Premier segment de câblage pavillonnaire (courtes longueurs).'
  },
  {
    key: 'cablePav2',
    label: 'Câble pavillon tranche 2',
    code: 'CABLE_PAV_2',
    description: 'Deuxième segment de câblage pavillonnaire (moyennes longueurs).'
  },
  {
    key: 'cablePav3',
    label: 'Câble pavillon tranche 3',
    code: 'CABLE_PAV_3',
    description: 'Troisième segment de câblage pavillonnaire (longueurs importantes).'
  },
  {
    key: 'cablePav4',
    label: 'Câble pavillon tranche 4',
    code: 'CABLE_PAV_4',
    description: 'Quatrième segment de câblage pavillonnaire (très longues distances).'
  },
  {
    key: 'clem',
    label: 'Mise en service',
    code: 'CLEM',
    description: 'Réouverture ou lancement d’un service pour un client.'
  },
  {
    key: 'reconnexion',
    label: 'Reconnexion',
    code: 'RECOIP',
    description: 'Reconnexion après suspension ou déménagement.'
  },
  {
    key: 'racImmeuble',
    label: 'Raccordement immeuble',
    code: 'RACIH',
    description: 'Raccordement d’un immeuble collectif ou d’un site groupé.'
  },
  {
    key: 'racProS',
    label: 'Raccordement pro simple',
    code: 'RACPRO_S',
    description: 'Installation pro classique sans contraintes techniques.'
  },
  {
    key: 'racProC',
    label: 'Raccordement pro complexe',
    code: 'RACPRO_C',
    description: 'Installation professionnelle nécessitant du matériel ou du temps supplémentaire.'
  },
  {
    key: 'racF8',
    label: 'Prestation F8',
    code: 'REPFOU_PRI',
    description: 'Réparation de fourreaux bouchés en domaine privé.'
  },
  {
    key: 'deprise',
    label: 'Déplacement prise',
    code: 'DEPLPRISE',
    description: 'Modification ou déplacement d’une prise existante.'
  },
  {
    key: 'demo',
    label: 'Démonstration service',
    code: 'DEMO',
    description: 'Présentation du service au client (démonstration commerciale).'
  },
  {
    key: 'sav',
    label: 'Service après-vente',
    code: 'SAV',
    description: 'Intervention corrective suite à une anomalie détectée.'
  },
  {
    key: 'savExp',
    label: 'SAV Expédition',
    code: 'SAV_EXP',
    description: 'SAV sans déplacement physique (expédition ou assistance à distance).'
  },
  {
    key: 'refrac',
    label: 'Refaire raccordement',
    code: 'REFRAC',
    description: 'Refait d’un raccordement suite à une reprise ou une erreur.'
  },
  {
    key: 'refcDgr',
    label: 'Dégradation client',
    code: 'REFC_DGR',
    description: 'Travail lié à des dégradations volontaires ou involontaires du client.'
  }
];
