// lib/share.js
import { openInMini, composeCast } from './miniapp'

/** ---------- URL helpers ---------- */
function siteOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'
}

export function safeUrl(u = '') {
  try { return new URL(String(u || ''), siteOrigin()).toString() } catch { return '' }
}

function normEmbeds(embeds) {
  if (!embeds) return []
  const list = Array.isArray(embeds) ? embeds : [embeds]
  return list.map(e => safeUrl(e)).filter(Boolean)
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

  // CTA + link
  const lineWithUrl = url ? `Play → ${url}` : ''
  if (style === 'short') {
    if (lineWithUrl) bits.push(lineWithUrl)
  } else if (style === 'serious') {
    if (lineWithUrl) bits.push(lineWithUrl)
  } else {
    if (lineWithUrl) bits.push(`Fill it, win it → ${url} 🎯`)
  }

  // Hashtags last
  bits.push(hashtags)

  return bits.filter(Boolean).join('\n')
}

/** ---------- Share URL builders ---------- */
export function buildShareUrls({ url = '', text = '', embeds = [] } = {}) {
  const shareUrl = safeUrl(url)
  const embedList = normEmbeds(embeds)

  // X/Twitter
  const xBase = 'https://twitter.com/intent/tweet'
  const xParams = new URLSearchParams()
  if (text) xParams.set('text', text)
  if (shareUrl && !(text || '').includes(shareUrl)) xParams.set('url', shareUrl)

  // Warpcast
  const warpBase = 'https://warpcast.com/~/compose'
  const wcParams = new URLSearchParams()
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

/** High-level: share/cast with style + embeds */
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
} = {}) {
  const text = buildCastText({
    style, url, word, blankLabel, title, theme, templateName, feeEth, durationMins, hashtagList
  })
  // Try native compose if SDK provides it:
  const composed = await composeCast({ text, embeds: normEmbeds(embeds) })
  if (composed) return

  // Fallback to compose URL:
  const href = buildWarpcastCompose({ url, text, embeds })
  await openShareWindow(href)
}
