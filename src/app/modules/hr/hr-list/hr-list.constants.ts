import { AbsenceStatus } from '../../../core/models';

export const NORMALIZED_CONTRACT_LABELS = {
  FREELANCE: 'Freelance',
  SALARIE: 'Salarié',
  AUTRE: 'Autres',
  PERSONNALISE: 'Personnalisé'
} as const;

export const ABSENCE_TYPE_LABELS: Record<string, string> = {
  CONGE: 'Congé',
  MALADIE: 'Maladie',
  PERMISSION: 'Permission',
  FORMATION: 'Formation',
  AUTRE: 'Autre'
};

export const ABSENCE_STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  APPROUVE: 'Approuvé',
  REFUSE: 'Refusé'
};

export const HR_DOC_TYPES = [
  { value: 'CNI', label: 'CNI' },
  { value: 'PERMIS', label: 'Permis' },
  { value: 'CONTRAT', label: 'Contrat' },
  { value: 'CARTE_VITALE', label: 'Carte vitale' },
  { value: 'ATTESTATION', label: 'Attestation' },
  { value: 'HABILITATION', label: 'Habilitation' }
] as const;

export const HR_LEAVE_TYPES = ['CONGE', 'MALADIE', 'PERMISSION', 'FORMATION', 'AUTRE'] as const;

export const HR_CONTRACT_TYPES = [
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'SALARIE', label: 'Salarié' },
  { value: 'AUTRE', label: 'Autres' },
  { value: 'PERSONNALISE', label: 'Personnalisé' }
] as const;

export const HR_EMPLOYEE_ROLES = [
  { value: '', label: 'Tous les rôles' },
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'DIRIGEANT', label: 'DIRIGEANT' },
  { value: 'GESTION_DEPOT', label: 'GESTION_DEPOT' },
  { value: 'TECHNICIEN', label: 'TECHNICIEN' }
] as const;

export const HR_COMPLIANCE_FILTERS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'OK', label: 'Conforme' },
  { value: 'MISSING', label: 'Manquant' }
] as const;

export const HR_HABILITATION_OPTIONS = [
  { value: 'ELECTRIQUE', label: 'Électrique' },
  { value: 'TRAVAIL_HAUTEUR', label: 'Travail en hauteur' }
] as const;

export const HR_ALLOWED_ABSENCE_STATUSES: AbsenceStatus[] = ['EN_ATTENTE', 'APPROUVE', 'REFUSE'];
