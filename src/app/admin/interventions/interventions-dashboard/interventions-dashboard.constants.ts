import { InterventionSummaryQuery, InterventionItem } from '../../../core/services/intervention.service';
import { InterventionRates } from '../../../core/services/intervention-rates.service';
import { isRacihSuccess, isRacpavSuccess } from '../../../core/utils/intervention-prestations';

export const EMPTY_SUMMARY_FILTERS: InterventionSummaryQuery = {
  fromDate: undefined,
  toDate: undefined,
  technician: undefined,
  region: undefined,
  client: undefined,
  status: undefined,
  type: undefined
};

export const HIDDEN_PRESTATION_CODES = ['CABLE_SL', 'BIFIBRE', 'CLEM', 'DEMO', 'REFRAC'] as const;

export const DETAIL_SUMMARY_PRESTATIONS = [
  { label: 'RAC_PBO_SOUT', key: 'racPavillon' },
  { label: 'RAC_PBO_AERIEN', key: 'racAerien' },
  { label: 'RAC_PBO_FACADE', key: 'racFacade' },
  { label: 'RACIH', key: 'racImmeuble' },
  { label: 'RECOIP', key: 'reconnexion' },
  { label: 'RACPRO_S', key: 'racProS' },
  { label: 'RACPRO_C', key: 'racProC' },
  { label: 'SAV', key: 'sav' },
  { label: 'SAV_EXP', key: 'savExp' },
  { label: 'DEPLPRISE', key: 'deplacementPrise' },
  { label: 'DEPLACEMENT_OFFERT', key: 'deplacementOffert' },
  { label: 'DEPLACEMENT_A_TORT', key: 'deplacementATort' },
  { label: 'SWAP_EQUIPEMENT', key: 'swapEquipement' }
] as const;

export const DETAIL_GROUP_ORDER = [
  { key: 'RACPAV', label: 'RACPAV' },
  { key: 'RAC_PBO_AERIEN', label: 'RAC_PBO_AERIEN' },
  { key: 'RAC_PBO_FACADE', label: 'RAC_PBO_FACADE' },
  { key: 'RACIH', label: 'RACIH' },
  { key: 'RECOIP', label: 'RECOIP' },
  { key: 'RACPRO_S', label: 'RACPRO_S' },
  { key: 'RACPRO_C', label: 'RACPRO_C' },
  { key: 'SAV', label: 'SAV' },
  { key: 'SAV_EXP', label: 'SAV_EXP' },
  { key: 'DEPLPRISE', label: 'DEPLPRISE' },
  { key: 'DEPLACEMENT_OFFERT', label: 'DEPLACEMENT_OFFERT' },
  { key: 'DEPLACEMENT_A_TORT', label: 'DEPLACEMENT_A_TORT' },
  { key: 'SWAP_EQUIPEMENT', label: 'SWAP_EQUIPEMENT' },
  { key: 'other', label: 'Autres' }
] as const;

export const INTERVENTION_CONTRACT_TYPES = ['CDI', 'CDD', 'STAGE', 'FREELANCE', 'AUTRE'] as const;

export const QUICK_SUMMARY_PRESTATIONS = [
  { id: 'racpav', label: 'RACPAV', code: 'RACPAV' },
  { id: 'rac_pbo_aerien', label: 'RAC_PBO_AERIEN', key: 'racAerien' },
  { id: 'rac_pbo_facade', label: 'RAC_PBO_FACADE', key: 'racFacade' },
  { id: 'racih', label: 'RACIH', key: 'racImmeuble' },
  { id: 'recoip', label: 'RECOIP', key: 'reconnexion' },
  { id: 'plv_pro_s', label: 'PLV_PRO_S', key: 'racProS' },
  { id: 'plv_pro_c', label: 'PLV_PRO_C', key: 'racProC' },
  { id: 'sav', label: 'SAV', key: 'sav' },
  { id: 'rac_pbo_sout', label: 'RAC_PBO_SOUT', code: 'RAC_PBO_SOUT' },
  { id: 'deplacement_offert', label: 'DEPLACEMENT_OFFERT', key: 'deplacementOffert' },
  { id: 'deplacement_a_tort', label: 'DEPLACEMENT_A_TORT', key: 'deplacementATort' },
  { id: 'swap_equipement', label: 'SWAP_EQUIPEMENT', key: 'swapEquipement' }
] as const;

export const REVENUE_KEYS = [
  'racPavillon',
  'racAerien',
  'racFacade',
  'clem',
  'reconnexion',
  'racImmeuble',
  'racProS',
  'racProC',
  'racF8',
  'fourreauBeton',
  'prestaCompl',
  'deplacementPrise',
  'deplacementOffert',
  'deplacementATort',
  'demo',
  'sav',
  'savExp',
  'swapEquipement',
  'refrac',
  'refcDgr',
  'cableSl',
  'bifibre',
  'nacelle'
] as const satisfies readonly (keyof InterventionRates)[];

export const REVENUE_CODE_ALIASES = new Map<string, string>([
  ['RECO', 'RECOIP'],
  ['RECONNEXION', 'RECOIP'],
  ['RECOIP', 'RECOIP'],
  ['RAC PAV', 'RACPAV'],
  ['RAC PAVILLON', 'RACPAV'],
  ['RAC_PAV', 'RACPAV'],
  ['RAC_PAVILLON', 'RACPAV'],
  ['RACPAV', 'RACPAV'],
  ['RAC IMM', 'RACIH'],
  ['RAC IMMEUBLE', 'RACIH'],
  ['RAC_IMM', 'RACIH'],
  ['RAC_IMMEUBLE', 'RACIH'],
  ['RACIH', 'RACIH'],
  ['PRO S', 'RACPRO_S'],
  ['PRO C', 'RACPRO_C'],
  ['RAC PRO S', 'RACPRO_S'],
  ['RAC PRO C', 'RACPRO_C'],
  ['RACPRO_S', 'RACPRO_S'],
  ['RACPRO_C', 'RACPRO_C'],
  ['PRESTA COMPL', 'PRESTA_COMPL'],
  ['PRESTATION COMPLEMENTAIRE', 'PRESTA_COMPL'],
  ['PRESTA_COMPL', 'PRESTA_COMPL'],
  ['PRESTAT F8', 'REPFOU_PRI'],
  ['PRESTATION F8', 'REPFOU_PRI'],
  ['F8', 'REPFOU_PRI'],
  ['REPFOU_PRI', 'REPFOU_PRI'],
  ['CLEM', 'CLEM'],
  ['SAV', 'SAV'],
  ['SAV EXP', 'SAV_EXP'],
  ['SAV_EXP', 'SAV_EXP'],
  ['DEMO', 'DEMO']
]);

export function normalizeInterventionText(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export function isSfrB2bMarque(value?: string | null): boolean {
  const normalized = normalizeInterventionText(value);
  if (!normalized) return false;
  if (normalized.includes('SFR B2B')) return true;
  return normalized.replace(/\s+/g, '').includes('SFRB2B');
}

export function hasReconnexionInArticles(raw?: string | null): boolean {
  const normalized = normalizeInterventionText(raw);
  return Boolean(normalized && normalized.includes('RECOIP'));
}

export function extractCodesFromText(value?: string | null): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,;+]/)
    .map((entry) => entry.replace(/"/g, '').trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/\s+x?\d+$/i, '').trim())
    .map((entry) => entry.replace(/\s+/g, '_'))
    .map((entry) => entry.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase())
    .filter(Boolean);
}

export function extractImportedArticleCodes(item: InterventionItem): string[] {
  return extractCodesFromText(item.articlesRaw);
}

export function resolveSuccessPrestations(item: InterventionItem): string[] {
  const statusNormalized = normalizeInterventionText(item.statut);
  if (!(statusNormalized.includes('CLOTURE') && statusNormalized.includes('TERMINEE'))) {
    return [];
  }
  const typeNormalized = normalizeInterventionText(item.type).replace(/-/g, ' ').trim();
  const articlesNormalized = normalizeInterventionText(item.articlesRaw);
  const commentsNormalized = normalizeInterventionText(item.commentairesTechnicien);
  const prestationsNormalized = normalizeInterventionText(item.listePrestationsRaw);
  const isSfrB2b = isSfrB2bMarque(item.marque);
  const matches: string[] = [];

  if (isRacpavSuccess(item.statut, item.articlesRaw)) matches.push('RACPAV');
  if (isRacihSuccess(item.statut, item.articlesRaw)) matches.push('RACIH');
  if (!isSfrB2b && (articlesNormalized.includes('RECOIP') || typeNormalized === 'RECO')) {
    matches.push('RECOIP');
  }
  if (isSfrB2b) {
    matches.push('RACPRO_S');
  }
  if (articlesNormalized.includes('RACPROS_S') || articlesNormalized.includes('RACPRO_S')) {
    matches.push('RACPRO_S');
  }
  if (articlesNormalized.includes('RACPROC_C') || articlesNormalized.includes('RACPRO_C')) {
    matches.push('RACPRO_C');
  }
  if (articlesNormalized.includes('SAV') || typeNormalized === 'SAV') {
    matches.push('SAV');
  }
  if ((typeNormalized.includes('PRESTA') && typeNormalized.includes('COMPL')) || articlesNormalized.includes('PRESTA_COMPL')) {
    matches.push('PRESTA_COMPL');
  }
  if (
    articlesNormalized.includes('REPFOU_PRI')
    || commentsNormalized.includes('F8')
    || prestationsNormalized.includes('FOURREAUX')
    || prestationsNormalized.includes('DOMAINE')
  ) {
    matches.push('REPFOU_PRI');
  }
  if (typeNormalized === 'REFC_DGR' || statusNormalized.includes('REFC_DGR')) {
    matches.push('REFC_DGR');
  }
  if (typeNormalized === 'DEPLPRISE' || articlesNormalized.includes('DEPLPRISE')) {
    matches.push('DEPLPRISE');
  }
  if (typeNormalized === 'REFRAC' || articlesNormalized.includes('REFRAC')) {
    matches.push('REFRAC');
  }

  return matches;
}

export function resolveBillingCodes(item: InterventionItem): string[] {
  const codes = new Set<string>();
  for (const code of extractCodesFromText(item.articlesRaw)) {
    codes.add(code);
  }
  for (const code of extractCodesFromText(item.listePrestationsRaw)) {
    codes.add(code);
  }
  for (const code of resolveSuccessPrestations(item)) {
    codes.add(code);
  }

  const normalized = normalizeInterventionText(`${item.articlesRaw || ''} ${item.listePrestationsRaw || ''}`);
  const isSfrB2b = isSfrB2bMarque(item.marque);
  if (normalized.includes('CABLE PAV 1') || normalized.includes('CABLE_PAV_1')) codes.add('CABLE_PAV_1');
  if (normalized.includes('CABLE PAV 2') || normalized.includes('CABLE_PAV_2')) codes.add('CABLE_PAV_2');
  if (normalized.includes('CABLE PAV 3') || normalized.includes('CABLE_PAV_3')) codes.add('CABLE_PAV_3');
  if (normalized.includes('CABLE PAV 4') || normalized.includes('CABLE_PAV_4')) codes.add('CABLE_PAV_4');
  if (normalized.includes('RAC PRO S') || normalized.includes('RACPRO S')) codes.add('RACPRO_S');
  if (normalized.includes('RAC PRO C') || normalized.includes('RACPRO C')) codes.add('RACPRO_C');
  if (normalized.includes('CLEM')) codes.add('CLEM');

  if (!isRacihSuccess(item.statut, item.articlesRaw)) {
    codes.delete('RACIH');
  }
  if (isSfrB2b) {
    codes.delete('RECOIP');
  }

  return [...codes];
}
