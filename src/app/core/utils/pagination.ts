export function formatPageRange(page: number, limit: number, total: number): string {
  if (!Number.isFinite(page) || !Number.isFinite(limit) || !Number.isFinite(total) || total <= 0 || limit <= 0) {
    return '0-0 sur 0';
  }
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return `${start}-${end} sur ${total}`;
}
