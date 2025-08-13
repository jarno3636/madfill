// lib/share.js

/** ---------- URL helpers ---------- */
/** Normalize to absolute URL. Allows relative input. */
function safeUrl(u = '') {
  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app')
    return new URL(String(u || ''), base).toString()
  } catch {
    return ''
  }
}

/** Accepts string | string[] | undefined and returns absolute URLs array */
function normEmbeds(embeds) {
  if (!embeds) return []
  const list = Array.isArray(embeds) ? embeds : [embeds]
  return list.map((e) => safeUrl(e)).filter(Boolean)
}

/** ---------- Public API ---------- */
/**
 * Build social share URLs.
 * @param {{url?: string, text?: string, embed?: string, embeds?: string[]}} opts
 * - `embed` kept for backward compatibility; `embeds` preferred (array).
 */
export function buildShareUrls({ url = '', text = '', embed = '', embeds = [] } = {}) {
  const shareUrl = safeUrl(url)
  const embedList = normEmbeds(embed ? [embed, ...embeds] : embeds)

  const message = text || shareUrl

  // X/Twitter
  const xBase = 'https://twitter.com/intent/tweet'
  const xParams = new URLSearchParams()
  if (message) xParams.set('text', message)
  // if the URL is not already in the message, add it as url=
  if (shareUrl && !(message || '').includes(shareUrl)) xParams.set('url', shareUrl)

  // Warpcast
  const warpBase = 'https://warpcast.com/~/compose'
  const wcParams = new URLSearchParams()
  const wcText = shareUrl && !message.includes(shareUrl) ? `${message} ${shareUrl}` : message
  if (wcText) wcParams.set('text', wcText)
  for (const e of embedList) wcParams.append('embeds[]', e)

  return {
    twitter: `${xBase}?${xParams.toString()}`,
    warpcast: `${warpBase}?${wcParams.toString()}`,
  }
}

/** Direct builder for Warpcast with multiple embeds */
export function buildWarpcastCompose({ text = '', url = '', embeds = [] } = {}) {
  const { warpcast } = buildShareUrls({ url, text, embeds })
  return warpcast
}

/** Direct builder for X/Twitter */
export function buildXIntent({ text = '', url = '' } = {}) {
  const { twitter } = buildShareUrls({ url, text })
  return twitter
}

/** Open a share URL in a popup or Farcaster MiniApp (if available), else _blank */
export async function openShareWindow(href, { w = 600, h = 700 } = {}) {
  const target = safeUrl(href)
  if (!target) return

  // Try Farcaster MiniApp first (only loaded on client)
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    if (mod?.sdk?.actions?.openURL) {
      await mod.sdk.actions.openURL(target)
      return
    }
  } catch {
    // ignore—fall through to window.open flows
  }

  try {
    if (typeof window === 'undefined') return
    const oh = window.top?.outerHeight ?? window.outerHeight
    const ow = window.top?.outerWidth ?? window.outerWidth
    const y = oh ? Math.max(0, (oh - h) / 2) : 0
    const x = ow ? Math.max(0, (ow - w) / 2) : 0
    const win = window.open(
      target,
      '_blank',
      `popup=yes,width=${w},height=${h},left=${x},top=${y},noopener,noreferrer`
    )
    if (win && win.focus) win.focus()
  } catch {
    if (typeof window !== 'undefined') {
      window.open(target, '_blank', 'noopener,noreferrer')
    }
  }
}

/** ---------- Clipboard + Native Share ---------- */
export async function copyToClipboard(text = '') {
  try {
    if (!text) return false
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback (rare)
    if (typeof document === 'undefined') return false
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'absolute'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

/**
 * Uses the native Web Share API when available.
 * Returns true if the native dialog was opened, false otherwise.
 */
export async function nativeShare({ title = '', text = '', url = '' } = {}) {
  try {
    if (typeof navigator !== 'undefined' && navigator.share && (url || text)) {
      await navigator.share({ title, text, url })
      return true
    }
  } catch {
    // ignore – fall through to clipboard in caller
  }
  return false
}
