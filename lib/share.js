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
export function openWebWindow(target, { w = 680, h = 760 } = {}) {
  try {
    if (typeof window === 'undefined') return false
    const oh = window.top?.outerHeight ?? window.outerHeight ?? 0
    const ow = window.top?.outerWidth ?? window.outerWidth ?? 0
    const top = oh > h ? Math.max(0, (oh - h) / 2) : 0
    const left = ow > w ? Math.max(0, (ow - w) / 2) : 0
    const win = window.open(
      target,
      '_blank',
      `popup=yes,width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`
    )
    if (win && win.focus) win.focus()
    return true
  } catch {
    if (typeof window !== 'undefined') window.open(target, '_blank', 'noopener,noreferrer')
    return true
  }
}

/** Clipboard + native share helpers */
export async function copyToClipboard(text = '') {
  try {
    if (!text) return false
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}
  return false
}

export async function nativeShare({ title = '', text = '', url = '' } = {}) {
  try {
    if (typeof navigator !== 'undefined' && navigator.share && (text || url)) {
      await navigator.share({ title, text, url: safeAbsoluteUrl(url) })
      return true
    }
  } catch {}
  return false
}
