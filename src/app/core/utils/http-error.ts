/**
 * Extracts a user-friendly error message from an HTTP error response.
 */
export function apiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e['error'] === 'object' && e['error'] !== null) {
      const msg = (e['error'] as Record<string, unknown>)['message'];
      if (typeof msg === 'string' && msg) return msg;
    }
    if (typeof e['message'] === 'string' && e['message']) return e['message'];
  }
  return fallback;
}
