export function parseFiniteNumber(value?: number | string | null): number {
  if (value === null || value === undefined) return 0;
  const normalized = typeof value === 'string'
    ? value.replace(/\s+/g, '').replace(',', '.')
    : value;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : 0;
}
