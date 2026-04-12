import { TechnicianReport } from '../services/technician-report.service';

export type NormalizedReportPrestation = {
  code: string;
  qty: number;
  label: string;
};

export const REPORT_CODE_ALIASES: Record<string, string> = {
  RACPAV: 'RAC_PBO_SOUT'
};

export function normalizeReportPrestations(report: TechnicianReport): NormalizedReportPrestation[] {
  const entries = Array.isArray(report.entries) ? report.entries : [];
  if (entries.length) {
    return entries
      .map((entry) => ({
        code: String(entry.codeSnapshot || entry.code || '').trim().toUpperCase(),
        qty: Number(entry.quantite ?? entry.qty ?? 0),
        label: String(entry.libelleSnapshot || entry.codeSnapshot || entry.code || '').trim()
      }))
      .filter((item) => item.code && item.qty > 0);
  }

  return (report.prestations || [])
    .map((item) => {
      const code = String(item.code || '').trim().toUpperCase();
      return {
        code,
        qty: Number(item.qty ?? 0),
        label: code
      };
    })
    .filter((item) => item.code && item.qty > 0);
}

export function computeReportAmount(report: TechnicianReport, prices?: Map<string, number>): number {
  if (Number.isFinite(Number(report.totalCa))) {
    return Number(report.totalCa);
  }

  const entries = Array.isArray(report.entries) ? report.entries : [];
  if (entries.length) {
    const total = entries.reduce((sum, entry) => {
      if (Number.isFinite(Number(entry.totalCaLigne))) {
        return sum + Number(entry.totalCaLigne);
      }
      if (Number.isFinite(Number(entry.montantLigne))) {
        return sum + Number(entry.montantLigne);
      }
      const qty = Number(entry.quantite ?? entry.qty ?? 0);
      const price = Number(entry.prixUnitaireSnapshot ?? 0);
      return sum + (qty > 0 && Number.isFinite(price) ? qty * price : 0);
    }, 0);
    if (total > 0) return Number(total.toFixed(2));
  }

  const prestations = Array.isArray(report.prestations) ? report.prestations : [];
  if (!prestations.length) return Number(report.amount ?? 0);
  if (!prices?.size) return Number(report.amount ?? 0);

  let total = 0;
  for (const { code, qty } of prestations) {
    if (!qty) continue;
    const key = String(code || '').trim().toUpperCase();
    let price = prices.get(key);
    if (!Number.isFinite(price)) {
      const aliasKey = REPORT_CODE_ALIASES[key];
      if (aliasKey) price = prices.get(aliasKey);
    }
    if (Number.isFinite(price)) total += qty * Number(price);
  }

  return total > 0 ? Number(total.toFixed(2)) : Number(report.amount ?? 0);
}
