import { PrestationSegment } from './prestation-catalog.model';

export type EffectiveBpuSource = 'CATALOG' | 'OVERRIDE';

export interface EffectiveBpuItem {
  prestationId: string;
  code: string;
  libelle: string;
  segment: PrestationSegment;
  prixUnitaire: number;
  compteDansCa: boolean;
  compteDansAttachement: boolean;
  coefficientCa: number;
  coefficientAttachement: number;
  ordreAffichage: number;
  source: EffectiveBpuSource;
}
