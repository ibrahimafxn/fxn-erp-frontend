import { TechnicianReport } from '../services/technician-report.service';

export type NormalizedReportPrestation = {
  code: string;
  qty: number;
  label: string;
};

// Codes historiques PLV_PRO (utilisés jusqu'à fin mars 2026, arrêtés par SFR)
// → renommés en RACPRO uniquement pour les rapports antérieurs au 1er avril 2026
const PLV_PRO_ALIASES: Record<string, string> = {
  PLV_PRO_S: 'RACPRO_S',
  PLV_PRO_C: 'RACPRO_C'
};

const PLV_PRO_CUTOFF = new Date('2026-04-01').getTime();

export function canonicalCode(code: string, reportDate?: string | Date | null): string {
  if (PLV_PRO_ALIASES[code]) {
    const ts = reportDate ? new Date(reportDate).getTime() : 0;
    if (ts < PLV_PRO_CUTOFF) return PLV_PRO_ALIASES[code];
  }
  return code;
}

export function normalizeReportPrestations(report: TechnicianReport): NormalizedReportPrestation[] {
  const entries = Array.isArray(report.entries) ? report.entries : [];
  const reportDate = report.reportDate ?? null;

  if (entries.length) {
    return entries
      .map((entry) => {
        const raw = String(entry.codeSnapshot || entry.code || '').trim().toUpperCase();
        const code = canonicalCode(raw, reportDate);
        return {
          code,
          qty: Number(entry.quantite ?? entry.qty ?? 0),
          label: String(entry.libelleSnapshot || entry.codeSnapshot || entry.code || '').trim()
        };
      })
      .filter((item) => item.code && item.qty > 0);
  }

  return (report.prestations || [])
    .map((item) => {
      const raw = String(item.code || '').trim().toUpperCase();
      const code = canonicalCode(raw, reportDate);
      return {
        code,
        qty: Number(item.qty ?? 0),
        label: code
      };
    })
    .filter((item) => item.code && item.qty > 0);
}

/**
 * Calcule le montant d'un rapport en appliquant des prix configurés,
 * sans tenir compte de `totalCa` ni des montants pré-calculés dans `entries[]`.
 * Utile pour l'affichage admin où les prix BPU sont imposés par configuration.
 * Retombe sur `computeReportAmount(report)` si aucun code ne trouve de prix.
 */
export function applyPricesToReport(report: TechnicianReport, prices: Map<string, number>): number {
  const prestations = normalizeReportPrestations(report);
  if (!prestations.length || !prices.size) return computeReportAmount(report);

  let total = 0;
  let matched = false;
  for (const { code, qty } of prestations) {
    if (!qty) continue;
    // code est déjà canonicalisé par normalizeReportPrestations
    const unitPrice = prices.get(code);
    if (!Number.isFinite(unitPrice)) continue;
    matched = true;
    total += qty * Number(unitPrice);
  }

  return matched ? Number(total.toFixed(2)) : computeReportAmount(report);
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

  const reportDate = report.reportDate ?? null;
  let total = 0;
  for (const { code, qty } of prestations) {
    if (!qty) continue;
    const raw = String(code || '').trim().toUpperCase();
    const key = canonicalCode(raw, reportDate);
    const price = prices.get(key);
    if (Number.isFinite(price)) total += qty * Number(price);
  }

  return total > 0 ? Number(total.toFixed(2)) : Number(report.amount ?? 0);
}
