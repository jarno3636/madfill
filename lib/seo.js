// lib/seo.js

/** ---------- Site origins ---------- */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app').replace(/\/+$/, '')

/** Optional: Farcaster Mini App canonical (paste yours here or via env) */
export const MINIAPP_URL = (process.env.NEXT_PUBLIC_FC_MINIAPP_URL || 'https://farcaster.xyz/miniapps/k_MpThP1sYRl/madfill').replace(/\/+$/, '')

export const OG_COVER_URL = `${SITE_URL}/og/cover.png`

/** ---------- Helpers ---------- */
function asPath(input = '') {
  // Normalize any non-string-ish input to an empty string
  return typeof input === 'string' ? input : ''
}

export function isFarcasterUA() {
  if (typeof navigator === 'undefined') return false
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent)
}

/** Absolute URL on the web origin (SSR-safe) */
export function absoluteUrl(path = '') {
  const p = asPath(path)
  if (!p) return SITE_URL
  if (/^https?:\/\//i.test(p)) return p
  return `${SITE_URL}${p.startsWith('/') ? '' : '/'}${p}`
}

/** Absolute URL that prefers runtime origin if available (browser) */
export function runtimeAbsoluteUrl(path = '') {
  const p = asPath(path)
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const base = window.location.origin.replace(/\/+$/, '')
      if (!p) return base
      if (/^https?:\/\//i.test(p)) return p
      return `${base}${p.startsWith('/') ? '' : '/'}${p}`
    }
  } catch {
    // no-op
  }
  return absoluteUrl(p)
}

/** Farcaster-aware target:
 *  - In Farcaster app: use MINIAPP_URL
 *  - On web/elsewhere: use SITE_URL
 */
export function fcTarget(path = '') {
  const p = asPath(path)
  const base = isFarcasterUA() ? MINIAPP_URL : SITE_URL
  if (!p) return base
  if (/^https?:\/\//i.test(p)) return p
  return `${base}${p.startsWith('/') ? '' : '/'}${p}`
}

/** Build dynamic OG URL for your /api/og handler (absolute web URL). */
export function buildOgUrl(params = {}) {
  const url = new URL(absoluteUrl('/api/og'))
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) {
      const s = String(v).trim()
      if (s) url.searchParams.set(k, s)
    }
  }
  return url.toString()
}

/** Minimal site defaults */
export const DEFAULT_SEO = Object.freeze({
  title: 'MadFill',
  description: 'Fill the blank on Base. Create rounds, vote, and win the pool.',
  image: absoluteUrl('/api/og'),
})

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
  const imgAbs = image
    ? (/^https?:\/\//i.test(image) ? image : absoluteUrl(image))
    : OG_COVER_URL

  // Be defensive: accept only plain objects, clamp to 4
  const normButtons = (Array.isArray(buttons) ? buttons : [])
    .filter((b) => b && typeof b === 'object')
    .slice(0, 4)
    .map((b) => {
      const label = (b.label ?? 'Open')
      return {
        label: typeof label === 'string' ? label.slice(0, 32) : 'Open',
        action: b.action || 'link',
        // IMPORTANT: use fcTarget so taps stay in-app
        target: b.target ? fcTarget(b.target) : undefined,
      }
    })

  return {
    image: imgAbs,
    buttons: normButtons,
    splashImageUrl: splashImageUrl ? absoluteUrl(splashImageUrl) : undefined,
    splashBackgroundColor,
  }
}
