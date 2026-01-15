export function capitalizeText(value?: string | null): string {
  const str = String(value ?? '').trim();
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function upperText(value?: string | null): string {
  const str = String(value ?? '').trim();
  if (!str) return '';
  return str.toUpperCase();
}

export function formatPersonName(firstName?: string | null, lastName?: string | null): string {
  const first = capitalizeText(firstName);
  const last = upperText(lastName);
  return [first, last].filter(Boolean).join(' ').trim();
}

export function formatDepotName(name?: string | null): string {
  return capitalizeText(name);
}

export function formatResourceName(name?: string | null): string {
  return capitalizeText(name);
}
