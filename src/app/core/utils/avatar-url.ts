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

const AVATAR_PRESETS = new Set([
  '10491830',
  '35480b05',
  '9306614',
  '9334178',
  '9434619',
  '9720027',
  '9720029',
  '9963629',
  'd2090ffb',
  'voir',
  'admin-voir'
]);

export const resolveAvatarPreset = (value?: string | null): string => {
  if (!value) return '';
  if (!AVATAR_PRESETS.has(value)) return '';
  if (value === 'voir') return `assets/avatars/voir.gif`;
  if (value === 'admin-voir') return `assets/avatars/admin/voir.gif`;
  return `assets/avatars/${value}.jpg`;
};

export const resolveUserAvatarUrl = (
  user?: { photoUrl?: string | null; avatarUrl?: string | null; preferences?: { avatar?: string | null } } | null,
  cacheKey?: string | number | null
): string => {
  const preset = resolveAvatarPreset(user?.preferences?.avatar ?? null);
  if (preset) return preset;
  return resolveCloudinaryAvatarUrl(user?.photoUrl, user?.avatarUrl, cacheKey);
};
