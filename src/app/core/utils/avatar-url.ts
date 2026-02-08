export const CLOUDINARY_HOST = 'res.cloudinary.com';

export const isCloudinaryUrl = (value?: string | null): boolean => {
  if (!value) return false;
  return value.toLowerCase().includes(CLOUDINARY_HOST);
};

const withCacheBuster = (url: string, cacheKey?: string | number | null): string => {
  if (!cacheKey) return url;
  const key = String(cacheKey).trim();
  if (!key) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(key)}`;
};

export const resolveCloudinaryAvatarUrl = (
  photoUrl?: string | null,
  avatarUrl?: string | null,
  cacheKey?: string | number | null
): string => {
  const candidates = [photoUrl, avatarUrl]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const cloudinary = candidates.find((url) => isCloudinaryUrl(url));
  if (!cloudinary) return '';
  return withCacheBuster(cloudinary, cacheKey);
};
