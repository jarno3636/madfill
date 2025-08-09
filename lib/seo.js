// lib/seo.js
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'https://madfill.vercel.app';

export function absoluteUrl(path = '') {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Build an OG image URL for your /api/og route (adjust params to your handler).
 * Example: buildOgUrl({ screen: 'active', title: 'Active Rounds' })
 */
export function buildOgUrl(params = {}) {
  const url = new URL(absoluteUrl('/api/og'));
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  return url.toString();
}
