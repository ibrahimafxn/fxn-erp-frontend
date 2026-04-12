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
