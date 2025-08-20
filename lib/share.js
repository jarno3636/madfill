// lib/share.js
import { openInMini, composeCast } from './miniapp'

/** ---------- Config ---------- */
const SITE_FALLBACK = 'https://madfill.vercel.app'
const MINI_BASE =
  process.env.NEXT_PUBLIC_MINIAPP_URL // e.g. "https://farcaster.xyz/miniapps/<id>/madfill"
  || 'https://farcaster.xyz/miniapps/k_MpThP1sYRl/madfill'

/** ---------- URL helpers ---------- */
function siteOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || SITE_FALLBACK
}

export function safeUrl(u = '') {
  try { return new URL(String(u || ''), siteOrigin()).toString() } catch { return '' }
}

function normEmbeds(embeds) {
  if (!embeds) return []
  const list = Array.isArray(embeds) ? embeds : [embeds]
  return list.map(e => safeUrl(e)).filter(Boolean)
}

function isWarpcastUA() {
  return typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent || '')
}

/**
 * Prefer opening in Mini App (deep link) when we can.
 * Keeps the user inside Warpcast instead of booting the browser.
 */
export function preferMiniUrlIfPossible(webUrl, { forceMini = false } = {}) {
  const canonical = safeUrl(webUrl)
  if (!canonical) return ''
  const inWarpcast = isWarpcastUA() || forceMini

  // If we don’t have a Mini base configured, just return the web URL.
  if (!MINI_BASE) return canonical
  if (!inWarpcast) return canonical

  try {
    const u = new URL(canonical)
    // Preserve path + query; join with your Mini App base
    const mini = new URL(MINI_BASE)
    // Append original path/query after mini base
    // Example: https://.../madfill + /round/12?x=y
    const normalizedPath = u.pathname.startsWith('/') ? u.pathname : `/${u.pathname}`
    mini.pathname = (mini.pathname.replace(/\/$/, '') + normalizedPath).replace(/\/{2,}/g, '/')
    mini.search = u.search
    mini.hash = u.hash
    return mini.toString()
  } catch {
    return canonical
  }
}

/** Small helper: add UTM for browser shares (ignored by Warpcast) */
function withUtm(u) {
  try {
    const url = new URL(u)
    if (!url.searchParams.has('utm_source')) {
      url.searchParams.set('utm_source', 'share')
      url.searchParams.set('utm_medium', isWarpcastUA() ? 'warpcast' : 'web')
    }
    return url.toString()
  } catch { return u }
}

/** ---------- Cast text builder (fun!) ---------- */
/**
 * Build a catchy cast message.
 * @param {{
 *  style?: 'short'|'playful'|'serious',
 *  title?: string, theme?: string,
 *  feeEth?: string|number,
 *  durationMins?: number,
 *  templateName?: string,
 *  url?: string,
 *  hashtagList?: string[], // without '#'
 *  word?: string,
 *  blankLabel?: string, // e.g., "Blank #2"
 * }} o
 */
export function buildCastText(o = {}) {
  const {
    style = 'playful',
    title = 'MadFill',
    theme = '',
    feeEth,
    durationMins,
    templateName,
    url = '',
    hashtagList = ['MadFill', 'Base', 'Farcaster'],
    word = '',
    blankLabel = '',
  } = o

  const dur = Number(durationMins || 0)
  const minsToDays = (m) => (m >= 1440 ? `${(m/1440).toFixed(m % 1440 ? 1 : 0)}d` : `${m}m`)
  const feePretty = feeEth ? `${feeEth} ETH` : '0.0005 ETH'
  const hashtags = hashtagList.map(h => `#${h}`).join(' ')
  const bits = []

  // Header line
  if (style === 'short') {
    bits.push(`🧠 MadFill: “${title}”`)
  } else if (style === 'serious') {
    bits.push(`🧠 MadFill — ${title}${theme ? ` · ${theme}` : ''}`)
  } else {
    // playful
    bits.push(`🧠 MadFill: “${title}” ${theme ? `(${theme})` : ''} ✨`)
  }

  // Body lines
  if (word) bits.push(`I filled ${blankLabel || 'a blank'} with **${word}**.`)
  bits.push(`Entry: ${feePretty} + gas ${dur ? `· Ends in ~${minsToDays(dur)}` : ''}`)
  if (templateName) bits.push(`Template: ${templateName}`)

  // CTA + link (we keep link at the end to help Warpcast show the preview)
  if (url) bits.push(`Play → ${url}`)

  // Hashtags last
  bits.push(hashtags)

  return bits.filter(Boolean).join('\n')
}

/** ---------- Share URL builders ---------- */
export function buildShareUrls({
  url = '',
  text = '',
  embeds = [],
  forceMini = false, // allow callers to force the mini deep link
} = {}) {
  const webUrl = safeUrl(url)
  const miniPreferredUrl = preferMiniUrlIfPossible(webUrl, { forceMini })
  const shareUrl = withUtm(miniPreferredUrl || webUrl)
  const embedList = normEmbeds(embeds)

  // X/Twitter
  const xBase = 'https://twitter.com/intent/tweet'
  const xParams = new URLSearchParams()
  if (text) xParams.set('text', text)
  if (shareUrl && !(text || '').includes(shareUrl)) xParams.set('url', shareUrl)

  // Warpcast
  const warpBase = 'https://warpcast.com/~/compose'
  const wcParams = new URLSearchParams()
  // Warpcast prefers the link inside text; also supports embeds[]
  const wcText = shareUrl && !(text || '').includes(shareUrl) ? `${text} ${shareUrl}`.trim() : (text || '').trim()
  if (wcText) wcParams.set('text', wcText)
  for (const e of embedList) wcParams.append('embeds[]', e)

  // Telegram
  const tgBase = 'https://t.me/share/url'
  const tgParams = new URLSearchParams()
  if (shareUrl) tgParams.set('url', shareUrl)
  if (text) tgParams.set('text', text)

  return {
    twitter: `${xBase}?${xParams.toString()}`,
    warpcast: `${warpBase}?${wcParams.toString()}`,
    telegram: `${tgBase}?${tgParams.toString()}`,
  }
}

export function buildWarpcastCompose(opts) {
  const { warpcast } = buildShareUrls(opts)
  return warpcast
}
export function buildXIntent(opts) {
  const { twitter } = buildShareUrls(opts)
  return twitter
}

/** ---------- Openers ---------- */
export async function openShareWindow(href) {
  if (!href) return
  // openInMini will no-op to window.open when not in Warpcast
  await openInMini(href)
}

/** ---------- Clipboard + Native Share ---------- */
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
    if (typeof navigator !== 'undefined' && navigator.share && (url || text)) {
      await navigator.share({ title, text, url })
      return true
    }
  } catch {}
  return false
}

/** ---------- High-level: share/cast with style + embeds ---------- */
export async function shareToWarpcast({
  style = 'playful',
  url = '',
  word = '',
  blankLabel = '',
  title = '',
  theme = '',
  templateName = '',
  feeEth,
  durationMins,
  hashtagList,
  embeds = [],
  forceMini = false, // expose to callers (usually not needed)
} = {}) {
  // Prefer Mini deep-link in the text itself (keeps user inside Warpcast)
  const miniUrl = preferMiniUrlIfPossible(url, { forceMini }) || url

  const text = buildCastText({
    style,
    url: miniUrl,
    word,
    blankLabel,
    title,
    theme,
    templateName,
    feeEth,
    durationMins,
    hashtagList,
  })

  // 1) Try native compose via SDK (stays inside Warpcast app)
  const composed = await composeCast({ text, embeds: normEmbeds(embeds) })
  if (composed) return

  // 2) Fallback to compose URL (works on web + Warpcast)
  const href = buildWarpcastCompose({ url: miniUrl, text, embeds, forceMini })
  await openShareWindow(href)
}

/** ---------- One-call helper used by UI buttons ---------- */
export async function shareOrCast({ text = '', embeds = [], url = '', forceMini = false } = {}) {
  try {
    const preferredUrl = preferMiniUrlIfPossible(url, { forceMini }) || url
    const fullText = preferredUrl && !String(text).includes(preferredUrl)
      ? `${text}\n${preferredUrl}`.trim()
      : (text || '').trim()

    // Try in-app first
    const ok = await composeCast({ text: fullText, embeds: normEmbeds(embeds) })
    if (ok) return true
  } catch {}

  // Try native share next
  const didShare = await nativeShare({ text, url })
  if (didShare) return true

  // Fallback to compose URL
  const href = buildWarpcastCompose({ text, url, embeds, forceMini })
  await openShareWindow(href)
  return true
}
