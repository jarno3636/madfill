// lib/share.js

/** ========= absolute URL helper ========= */
export function absoluteUrl(u = '') {
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

/** ========= Farcaster Mini App helpers ========= */
export async function isMiniApp() {
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    const { sdk } = mod || {}
    // if there is any context / client info, assume we are in Mini App
    return !!(sdk && (sdk.context?.client || sdk.actions))
  } catch {
    return false
  }
}

/**
 * Open Farcaster composer.
 * - If inside Mini App: use sdk.actions.composeCast({ text, embeds })
 * - Else: open web composer at warpcast.com/~/compose
 */
export async function openFarcasterCompose({ text = '', url = '', embeds = [] } = {}) {
  const targetUrl = absoluteUrl(url)
  const textWithUrl = targetUrl && !text.includes(targetUrl) ? `${text} ${targetUrl}` : text
  const embedList = (embeds || []).map((e) => absoluteUrl(e)).filter(Boolean)

  // Try Mini App native composer first
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    const { sdk } = mod || {}
    if (sdk?.actions?.composeCast) {
      await sdk.actions.composeCast({ text: textWithUrl, embeds: embedList })
      return
    }
  } catch {
    /* ignore and fall through to web */
  }

  // Fallback: open Warpcast web composer
  const params = new URLSearchParams()
  if (textWithUrl) params.set('text', textWithUrl)
  for (const e of embedList) params.append('embeds[]', e)
  const href = `https://warpcast.com/~/compose?${params.toString()}`
  openPopup(href, { w: 600, h: 700 })
}

/** X / Twitter intent */
export function openXIntent({ text = '', url = '' } = {}) {
  const shareUrl = absoluteUrl(url)
  const params = new URLSearchParams()
  if (text) params.set('text', text)
  if (shareUrl && !text.includes(shareUrl)) params.set('url', shareUrl)
  const href = `https://twitter.com/intent/tweet?${params.toString()}`
  openPopup(href, { w: 600, h: 600 })
}

/** Native share if possible, else copy */
export async function tryNativeShareOrCopy({ title = '', text = '', url = '' } = {}) {
  const shareUrl = absoluteUrl(url)
  try {
    if (typeof navigator !== 'undefined' && navigator.share && (text || shareUrl)) {
      await navigator.share({ title, text, url: shareUrl })
      return true
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl || text)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

/** Small centered popup helper */
export function openPopup(href, { w = 600, h = 700 } = {}) {
  if (typeof window === 'undefined') return
  try {
    const oh = window.top?.outerHeight ?? window.outerHeight
    const ow = window.top?.outerWidth ?? window.outerWidth
    const y = oh ? Math.max(0, (oh - h) / 2) : 0
    const x = ow ? Math.max(0, (ow - w) / 2) : 0
    const win = window.open(
      href,
      '_blank',
      `popup=yes,width=${w},height=${h},left=${x},top=${y},noopener,noreferrer`
    )
    if (win?.focus) win.focus()
  } catch {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}
