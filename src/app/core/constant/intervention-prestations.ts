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
    label: 'Raccordement pavillon (sout.)',
    code: 'RAC_PBO-SOUT',
    description: 'Raccordement pavillon en souterrain.'
  },
  {
    key: 'racAerien',
    label: 'Raccordement aerien',
    code: 'RAC_PBO_AERIEN',
    description: 'Raccordement pavillon en aerien.'
  },
  {
    key: 'racFacade',
    label: 'Raccordement facade',
    code: 'RAC_PBO_FACADE',
    description: 'Raccordement pavillon en facade.'
  },
  {
    key: 'cablePav1',
    label: 'Cable pavillon tranche 1',
    code: 'CABLE_PAV_1',
    description: 'Premier segment de cablage pavillonnaire (courtes longueurs).'
  },
  {
    key: 'cablePav2',
    label: 'Cable pavillon tranche 2',
    code: 'CABLE_PAV_2',
    description: 'Deuxieme segment de cablage pavillonnaire (moyennes longueurs).'
  },
  {
    key: 'cablePav3',
    label: 'Cable pavillon tranche 3',
    code: 'CABLE_PAV_3',
    description: 'Troisieme segment de cablage pavillonnaire (longueurs importantes).'
  },
  {
    key: 'cablePav4',
    label: 'Cable pavillon tranche 4',
    code: 'CABLE_PAV_4',
    description: 'Quatrieme segment de cablage pavillonnaire (tres longues distances).'
  },
  {
    key: 'clem',
    label: 'Mise en service',
    code: 'CLEM',
    description: 'Reouverture ou lancement du service pour un client.'
  },
  {
    key: 'reconnexion',
    label: 'Reconnexion',
    code: 'RECOIP',
    description: 'Reconnexion apres suspension ou demenagement.'
  },
  {
    key: 'racImmeuble',
    label: 'Raccordement immeuble',
    code: 'RACIH',
    description: 'Raccordement collectif ou site groupe.'
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
    description: 'Installation professionnelle necessitant du materiel ou du temps supplementaire.'
  },
  {
    key: 'racF8',
    label: 'Fourreau casse prive',
    code: 'FOURREAU_CASSE_PRIVE',
    description: 'Reparation de fourreaux casses en domaine prive.'
  },
  {
    key: 'prestaCompl',
    label: 'Prestation complementaire',
    code: 'PRESTA_COMPL',
    description: 'Prestation complementaire facturee en supplement.'
  },
  {
    key: 'deprise',
    label: 'Deplacement prise',
    code: 'DEPLPRISE',
    description: 'Modification ou deplacement de prise existante.'
  },
  {
    key: 'demo',
    label: 'Demonstration service',
    code: 'DEMO',
    description: 'Presentation du service au client.'
  },
  {
    key: 'sav',
    label: 'SAV (ancien)',
    code: 'SAV',
    description: 'Code SAV generique conserve pour compatibilite avec les anciens imports.'
  },
  {
    key: 'savExp',
    label: 'SAV EXP',
    code: 'SAV_EXP',
    description: 'SAV sans deplacement physique (expedition ou assistance a distance).'
  },
  {
    key: 'deplacementOffert',
    label: 'Deplacement offert',
    code: 'DEPLACEMENT_OFFERT',
    description: 'Deplacement offert au client (non facturable).'
  },
  {
    key: 'deplacementATort',
    label: 'Deplacement a tort',
    code: 'DEPLACEMENT_A_TORT',
    description: 'Deplacement a tort, client responsable.'
  },
  {
    key: 'swapEquipement',
    label: 'Swap equipement',
    code: 'SWAP_EQUIPEMENT',
    description: 'Echange equipement chez le client.'
  },
  {
    key: 'refrac',
    label: 'Refaire raccordement',
    code: 'REFRAC',
    description: 'Refait raccordement suite a une reprise ou une erreur.'
  },
  {
    key: 'refcDgr',
    label: 'Degradation client',
    code: 'REFC_DGR',
    description: 'Travail lie a des degradations volontaires ou involontaires du client.'
  }
];
