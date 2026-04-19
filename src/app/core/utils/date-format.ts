export function startOfToday(reference = new Date()): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
}

export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatFrDate(date: Date | string | number): string {
  return new Date(date).toLocaleDateString('fr-FR');
}

export function formatFrDateTime(date: Date | string | number): string {
  return new Date(date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Normalise une paire de dates (format yyyy-MM-dd) en paramètres API optionnels. */
export function normalizeDateRange(from: string, to: string): { fromDate?: string; toDate?: string } {
  return {
    fromDate: (from?.trim()) || undefined,
    toDate: (to?.trim()) || undefined
  };
}

/**
 * Variante avec bornes horaires — début de journée (T00:00:00) et fin de journée (T23:59:59.999).
 * Utilisée lorsque l'API attend des timestamps ISO complets.
 */
export function normalizeDateRangeWithTime(from: string, to: string): { fromDate?: string; toDate?: string } {
  return {
    fromDate: from ? `${from}T00:00:00` : undefined,
    toDate: to ? `${to}T23:59:59.999` : undefined
  };
}
