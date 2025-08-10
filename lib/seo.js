// lib/seo.js

/** ---------- Site origin (SSR-safe) ---------- */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ||
  'https://madfill.vercel.app'

/** Absolute URL using configured SITE_URL (safe on server) */
export function absoluteUrl(path = '') {
  if (!path) return SITE_URL
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Absolute URL that prefers the runtime origin when available (client) */
export function runtimeAbsoluteUrl(path = '') {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const base = window.location.origin.replace(/\/+$/, '')
      if (!path) return base
      if (/^https?:\/\//i.test(path)) return path
      return `${base}${path.startsWith('/') ? '' : '/'}${path}`
    }
  } catch {}
  // fall back to static SITE_URL (SSR / build)
  return absoluteUrl(path)
}

/**
 * Build an OG image URL for your /api/og handler.
 * Example: buildOgUrl({ screen: 'active', title: 'Active Rounds' })
 */
export function buildOgUrl(params = {}) {
  const url = new URL(absoluteUrl('/api/og'))
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  return url.toString()
}

/** Minimal, consistent site defaults */
export const DEFAULT_SEO = {
  title: 'MadFill',
  description: 'Fill the blank on Base. Create rounds, vote, and win the pool.',
  image: absoluteUrl('/api/og'), // fallback to dynamic OG endpoint
}

/** For canonical tags */
export function canonicalUrl(path = '') {
  return absoluteUrl(path || '/')
}

/**
 * Build Farcaster Frame meta values (for <Head>).
 * Usage:
 *   const fm = buildFrameMeta({
 *     image: buildOgUrl({ screen: 'active', title: 'Active Rounds' }),
 *     buttons: [{ label: 'Open', action: 'link', target: absoluteUrl('/active') }]
 *   })
 *   // then in <Head>:
 *   <meta property="fc:frame" content="vNext" />
 *   <meta property="fc:frame:image" content={fm.image} />
 *   {fm.buttons.map((b, i) => (
 *     <React.Fragment key={i}>
 *       <meta property={`fc:frame:button:${i+1}`} content={b.label} />
 *       <meta property={`fc:frame:button:${i+1}:action`} content={b.action} />
 *       {b.target && <meta property={`fc:frame:button:${i+1}:target`} content={b.target} />}
 *     </React.Fragment>
 *   ))}
 */
export function buildFrameMeta({
  image,
  buttons = [],
  splashImageUrl,
  splashBackgroundColor,
} = {}) {
  // Ensure image is absolute and cache-bustable if needed
  const imgAbs = image ? absoluteUrl(image) : absoluteUrl('/og/cover.png')

  const normButtons = buttons.slice(0, 4).map((b) => ({
    label: b.label || 'Open',
    action: b.action || 'link',
    target: b.target ? absoluteUrl(b.target) : undefined,
  }))

  return {
    image: imgAbs,
    buttons: normButtons,
    splashImageUrl: splashImageUrl ? absoluteUrl(splashImageUrl) : undefined,
    splashBackgroundColor,
  }
}
