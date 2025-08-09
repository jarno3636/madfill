// lib/seo.js
export const SITE = {
  name: 'MadFill',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app',
  twitter: '@madfill',              // your handle (no spaces)
  defaultImage: '/og/cover.PNG',    // served from /public
  description:
    'MadFill on Base. Fill the blank, vote, and win the pool. Create rounds and challenge friends.',
};

export function absoluteUrl(path = '') {
  if (!path) return SITE.url;
  try {
    return new URL(path, SITE.url).toString();
  } catch {
    return `${SITE.url}${path.startsWith('/') ? '' : '/'}${path}`;
  }
}

/** buildOg({
 *  image: '/og/cover.PNG' | `https://...`,
 *  id: '123', // optional (for round specific OG at /api/og?id=123)
 *  fallbackToDefault: true
 * })
 */
export function buildOg({ image, id, fallbackToDefault = true } = {}) {
  if (id) return absoluteUrl(`/api/og?id=${encodeURIComponent(id)}`);
  if (image) return absoluteUrl(image);
  if (fallbackToDefault) return absoluteUrl(SITE.defaultImage);
  return '';
}
