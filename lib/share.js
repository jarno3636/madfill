// lib/share.js

/** -------------------------------------------------------
 * Safe URL helpers
 * ----------------------------------------------------- */
export function safeAbsoluteUrl(u = '') {
  try {
    const base =
      (typeof window !== 'undefined' && window.location?.origin) ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://madfill.vercel.app'
    return new URL(String(u || ''), base).toString()
  } catch {
    return ''
  }
}

function encode(text = '') {
  return encodeURIComponent(text || '')
}

/** Build Warpcast compose URL with optional embeds[] (absolute) */
export function buildWarpcastComposeUrl({
  text = '',
  url = '',
  embeds = [],
} = {}) {
  // Prefer putting the URL directly in text so the composer shows a nice preview.
  const shareUrl = safeAbsoluteUrl(url)
  const fullText = shareUrl && !text.includes(shareUrl) ? `${text} ${shareUrl}`.trim() : text

  const params = new URLSearchParams()
  if (fullText) params.set('text', fullText)

  // Normalize embeds to absolute URLs
  const absEmbeds = (Array.isArray(embeds) ? embeds : [embeds]).filter(Boolean).map(safeAbsoluteUrl)
  for (const e of absEmbeds) params.append('embeds[]', e)

  return `https://warpcast.com/~/compose?${params.toString()}`
}

/** Build X/Twitter intent URL */
export function buildXIntentUrl({ text = '', url = '' } = {}) {
  const shareUrl = safeAbsoluteUrl(url)
  const params = new URLSearchParams()
  if (text) params.set('text', text)
  // ensure url is included at least once
  if (shareUrl && !text.includes(shareUrl)) params.set('url', shareUrl)
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

/** -------------------------------------------------------
 * Mini App SDK detection + open helpers
 * ----------------------------------------------------- */

/** Try to import the Mini App SDK (only on client) */
async function getMiniSdk() {
  if (typeof window === 'undefined') return null
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    return mod?.sdk || null
  } catch {
    return null
  }
}

/** True if we appear to be running inside Warpcast Mini App */
export async function isInFarcasterMiniApp() {
  // Fast UA hint
  if (typeof navigator !== 'undefined') {
    const ua = (navigator.userAgent || '').toLowerCase()
    if (ua.includes('warpcast') || ua.includes('farcaster')) return true
  }
  // Presence of sdk is the strong signal
  const sdk = await getMiniSdk()
  return !!sdk
}

/**
 * Open Warpcast compose.
 * Prefers Mini App SDK; otherwise opens a centered popup (or _blank).
 */
export async function openWarpcastCompose({ text = '', url = '', embeds = [] } = {}) {
  const composeUrl = buildWarpcastComposeUrl({ text, url, embeds })

  // 1) In-app: open via Mini App SDK (never sends user to an app-download page)
  const sdk = await getMiniSdk()
  if (sdk?.actions?.openURL) {
    try {
      await sdk.actions.openURL(composeUrl)
      return true
    } catch {
      // fall through to web open
    }
  }

  // 2) Web fallback: popup window (or tab)
  return openWebWindow(composeUrl)
}

/** Generic centered popup; falls back to _blank */
export function openWebWindow(target, { w
