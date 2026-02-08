export const CLOUDINARY_HOST = 'res.cloudinary.com';

export const isCloudinaryUrl = (value?: string | null): boolean => {
  if (!value) return false;
  return value.toLowerCase().includes(CLOUDINARY_HOST);
};

export const resolveCloudinaryAvatarUrl = (photoUrl?: string | null, avatarUrl?: string | null): string => {
  const candidates = [photoUrl, avatarUrl]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const cloudinary = candidates.find((url) => isCloudinaryUrl(url));
  return cloudinary || '';
};
