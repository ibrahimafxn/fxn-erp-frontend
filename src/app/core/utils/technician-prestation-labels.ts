const TECHNICIAN_PRESTATION_LABELS = new Map<string, string>([
  ['RAC_PBO_SOUT', 'Rac Sout'],
  ['RAC_PBO_AERIEN', 'Rac Aérien'],
  ['RAC_PBO_FACADE', 'Rac Façade'],
  ['RACIM', 'Rac Immeuble'],
  ['RACIH', 'Rac Immeuble'],
  ['RACPAV', 'Rac Pav'],
  ['PLV_PRO_S', 'PV PRO S'],
  ['RACPRO_S', 'PV PRO S'],
  ['PLV_PRO_C', 'PV PRO C'],
  ['RACPRO_C', 'PV PRO C'],
  ['RECOIP', 'Reco'],
  ['RECO', 'Reco'],
  ['CLEM', 'Mise en service'],
  ['FOURREAU_CASSE_PRIVE', 'Fourreau F8'],
  ['REPFOU_PRI', 'Fourreau F8'],
  ['FOURREAU_CASSE_BETON', 'Fourreau Béton'],
  ['REFRAC', 'Refrac'],
  ['REFRAC_DEGRADATION', 'Refc Dgr'],
  ['DEPLACEMENT_PRISE', 'Déplacement Prise'],
  ['DEPLACEMENT_OFFERT', 'Déplacement Offert'],
  ['DEPLACEMENT_A_TORT', 'Déplacement À Tort'],
  ['SAV', 'SAV'],
  ['SAV_EXP', 'SAV EXP'],
  ['SWAP_EQUIPEMENT', 'Swap'],
  ['BIFIBRE', 'Bifibre'],
  ['NACELLE', 'Nacelle'],
  ['CABLE_SL', 'Câble SL'],
  ['PRESTA_COMPL', 'Presta complémentaire'],
  ['DEMO', 'Demo']
]);

function normalizePrestationCode(value: string): string {
  return String(value || '').trim().toUpperCase();
}

export function formatTechnicianPrestationLabel(code: string, fallbackLabel = ''): string {
  const normalizedCode = normalizePrestationCode(code);
  if (normalizedCode && TECHNICIAN_PRESTATION_LABELS.has(normalizedCode)) {
    return TECHNICIAN_PRESTATION_LABELS.get(normalizedCode)!;
  }

  const fallback = String(fallbackLabel || '').trim();
  if (fallback) return fallback;
  return normalizedCode;
}
