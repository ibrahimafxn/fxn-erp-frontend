export type StockFamily =
  | 'PTO'
  | 'JARRETIERE'
  | 'BOITIER'
  | 'CABLE'
  | 'CONNECTIQUE'
  | 'OUTIL'
  | 'EPI'
  | 'AUTRE';

function normalizeStockText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s-]/g, '');
}

export function resolveStockFamily(input: {
  label?: string | null;
  category?: string | null;
}): StockFamily {
  const label = normalizeStockText(input.label || '');
  const category = normalizeStockText(input.category || '');
  const source = `${category} ${label}`.trim();

  if (source.includes('epi')) return 'EPI';
  if (source.includes('outil') || source.includes('tool')) return 'OUTIL';
  if (source.includes('pto')) return 'PTO';
  if (source.includes('jarretiere') || source.includes('jarret')) return 'JARRETIERE';
  if (source.includes('boitier') || source.includes('pbo') || source.includes('pboint')) return 'BOITIER';
  if (source.includes('cable') || source.includes('drop') || source.includes('fibre')) return 'CABLE';
  if (
    source.includes('connecteur')
    || source.includes('adapter')
    || source.includes('adaptateur')
    || source.includes('coupleur')
    || source.includes('cassette')
    || source.includes('sfp')
  ) return 'CONNECTIQUE';

  return 'AUTRE';
}
