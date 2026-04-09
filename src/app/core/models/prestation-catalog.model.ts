export type PrestationSegment = 'AUTO' | 'SALARIE' | 'PERSONNALISE' | 'AUTRE';

export type PrestationOwnerType = 'GLOBAL' | 'SEGMENT' | 'TECHNICIAN';

export type ReportStatus = 'DRAFT' | 'VALIDATED';

export interface PrestationCatalog {
  id: string;
  code: string;
  libelle: string;
  segment: PrestationSegment;
  famille?: string | null;
  unite?: string | null;
  prixUnitaireBase: number;
  active: boolean;
  visiblePourSaisie: boolean;
  compteDansCa: boolean;
  compteDansAttachement: boolean;
  coefficientCa: number;
  coefficientAttachement: number;
  ordreAffichage: number;
  dateEffet?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrestationCatalogListResult {
  total: number;
  page: number;
  limit: number;
  items: PrestationCatalog[];
}

export interface PrestationAssignment {
  id: string;
  prestationId: string;
  ownerType: PrestationOwnerType;
  ownerId?: string | null;
  active: boolean;
  ordre?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrestationTechnicianOverride {
  id: string;
  technicianId: string;
  prestationId: string;
  enabled?: boolean | null;
  prixUnitaireOverride?: number | null;
  coefficientCaOverride?: number | null;
  coefficientAttachementOverride?: number | null;
  ordreAffichageOverride?: number | null;
  createdAt?: string;
  updatedAt?: string;
}
