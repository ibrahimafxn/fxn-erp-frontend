const NORMALIZE_REGEX = /[\u0300-\u036f]/g;

const normalizeText = (value?: string | null): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(NORMALIZE_REGEX, '')
    .toUpperCase()
    .trim();

const normalizeCode = (value?: string | null): string =>
  normalizeText(value).replace(/[^A-Z0-9]/g, '');

export const hasRacpavInArticles = (articlesRaw?: string | null): boolean =>
  normalizeCode(articlesRaw).includes('RACPAV');

export const isRacihSuccess = (statut?: string | null, articlesRaw?: string | null): boolean => {
  const statusNormalized = normalizeText(statut);
  if (!(statusNormalized.includes('CLOTURE') && statusNormalized.includes('TERMINEE'))) {
    return false;
  }
  const articlesNormalized = normalizeText(articlesRaw);
  return articlesNormalized.includes('RACIH');
};

export const isRacpavSuccess = (statut?: string | null, articlesRaw?: string | null): boolean => {
  const statusNormalized = normalizeText(statut);
  if (statusNormalized !== 'CLOTURE TERMINEE') {
    return false;
  }
  return hasRacpavInArticles(articlesRaw);
};
