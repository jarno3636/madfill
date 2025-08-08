// lib/share.js

function enc(v = '') {
  return encodeURIComponent(String(v))
}

function safeUrl(u = '') {
  try {
    // allow relative URLs too
    return new URL(u, typeof window !== 'undefined' ? window.location.origin : 'https://madfill.vercel.app').toString()
  } catch {
    return ''
  }
}

/**
 * Build social share URLs.
 * @param {{url?: string, text?: string, embed?: string}} param0
 */
export function buildShareUrls({ url = '', text = '', embed = '' } = {}) {
  const shareUrl = safeUrl(url)
  const embedUrl = safeUrl(embed)

  const message = text || shareUrl
  const xBase = 'https://twitter.com/intent/tweet'
  const warpBase = 'https://warpcast.com/~/compose'

  const xParams = new URLSearchParams()
  if (message) xParams.set('text', message)
  if (shareUrl && !message.includes(shareUrl)) xParams.set('url', shareUrl)

  const wcParams = new URLSearchParams()
  // Warpcast likes everything in `text`
  const wcText = shareUrl && !message.includes(shareUrl) ? `${message} ${shareUrl}` : message
  if (wcText) wcParams.set('text', wcText)
  if (embedUrl) wcParams.set('embeds[]', embedUrl)

  return {
    twitter: `${xBase}?${xParams.toString()}`,
    warpcast: `${warpBase}?${wcParams.toString()}`,
  }
}

export async function copyToClipboard(text = '') {
  try {
    if (!text) return false
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback (rare)
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
    if (navigator?.share && (url || text)) {
      await navigator.share({ title, text, url })
      return true
    }
  } catch {
    // ignore, fall through to clipboard in caller
  }
  return false
}
