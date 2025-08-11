// lib/seo.js

/** ---------- Site origins ---------- */
export const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app').replace(/\/+$/, '')

/** Optional: Farcaster Mini App canonical (paste yours here or via env) */
export const MINIAPP_URL =
  (process.env.NEXT_PUBLIC_FC_MINIAPP_URL || 'https://farcaster.xyz/miniapps/k_MpThP1sYRl/madfill').replace(/\/+$/, '')

/** ---------- Helpers ---------- */
export function isFarcasterUA() {
  if (typeof navigator === 'undefined') return false
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent)
}

/** Absolute URL on the web origin (SSR-safe) */
export function absoluteUrl(path = '') {
  if (!path) return SITE_URL
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Absolute URL that prefers runtime origin if available (browser) */
export function runtimeAbsoluteUrl(path = '') {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const base = window.location.origin.replace(/\/+$/, '')
      if (!path) return base
      if (/^https?:\/\//i.test(path)) return path
      return `${base}${path.startsWith('/') ? '' : '/'}${path}`
    }
  } catch {}
  return absoluteUrl(path)
}

/** Farcaster-aware target:
 *  - In Farcaster app: use MINIAPP_URL
 *  - On web/elsewhere: use SITE_URL
 */
export function fcTarget(path = '') {
  const base = isFarcasterUA() ? MINIAPP_URL : SITE_URL
  if (!path) return base
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Build dynamic OG URL for your /api/og handler (absolute web URL). */
export function buildOgUrl(params = {}) {
  const url = new URL(absoluteUrl('/api/og'))
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  return url.toString()
}

/** Minimal site defaults */
export const DEFAULT_SEO = {
  title: 'MadFill',
  description: 'Fill the blank on Base. Create rounds, vote, and win the pool.',
  image: absoluteUrl('/api/og'),
}

/** Canonical (web) */
export function canonicalUrl(path = '') {
  return absoluteUrl(path || '/')
}

/** Farcaster Frame meta builder (uses Farcaster-aware targets) */
export function buildFrameMeta({
  image,
  buttons = [],
  splashImageUrl,
  splashBackgroundColor,
} = {}) {
  // OG image must be absolute (web is fine)
  const imgAbs = image ? ( /^https?:\/\//i.test(image) ? image : absoluteUrl(image) ) : absoluteUrl('/og/cover.png')

  const normButtons = buttons.slice(0, 4).map((b) => ({
    label: b.label || 'Open',
    action: b.action || 'link',
    // IMPORTANT: use fcTarget so taps stay in-app
    target: b.target ? fcTarget(b.target) : undefined,
  }))

  return {
    image: imgAbs,
    buttons: normButtons,
    splashImageUrl: splashImageUrl ? absoluteUrl(splashImageUrl) : undefined,
    splashBackgroundColor,
  }
}
