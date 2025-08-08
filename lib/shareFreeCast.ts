// lib/shareFreeCast.ts

type ShareArgs = {
  sentence: string
  word: string
  /** The link to promote in the post */
  link?: string
  /** Optional embed URL (Warpcast preview) */
  embedUrl?: string
  /** Open in new tab (default true) */
  newTab?: boolean
  /** Optional Twitter handle (without @) to attribute */
  via?: string
  /** Extra hashtags for Twitter (comma or array) */
  hashtags?: string | string[]
}

const LIMITS = {
  farcaster: 320,
  twitter: 280,
}

function normalizeHashtags(h: string | string[] | undefined) {
  if (!h) return ''
  const arr = Array.isArray(h) ? h : h.split(',').map(s => s.trim()).filter(Boolean)
  return arr.join(',')
}

function truncate(text: string, limit: number, reserveTail = 0) {
  const max = Math.max(0, limit - reserveTail)
  if (text.length <= max) return text
  const slice = text.slice(0, max - 1)
  const cut = slice.lastIndexOf(' ')
  return (cut > 40 ? slice.slice(0, cut) : slice).trimEnd() + '…'
}

function baseLines(sentence: string, word: string) {
  const header = '😄 I played a round of Free MadFill!'
  const quote = `"${sentence}"`
  const filled = `I filled in: ${word}`
  return { header, quote, filled }
}

// -------- Warpcast (Farcaster) --------

export function buildFreeCastUrl({
  sentence,
  word,
  link = 'https://madfill.vercel.app/free',
  embedUrl,
}: ShareArgs): string {
  const base = 'https://warpcast.com/~/compose'
  const { header, quote, filled } = baseLines(sentence, word)
  const tail = `Play your own here 👉 ${link} #MadFill #OnChainGames`

  const reservedTail = tail.length + 2
  const body = `${header}\n\n${quote}\n\n${filled}`
  const bodyTrimmed = truncate(body, LIMITS.farcaster, reservedTail)
  const text = `${bodyTrimmed}\n\n${tail}`

  const params = new URLSearchParams({ text })
  if (embedUrl) params.append('embeds[]', embedUrl)

  return `${base}?${params.toString()}`
}

export async function shareFreeCast(args: ShareArgs): Promise<string> {
  const url = buildFreeCastUrl(args)
  if (typeof window === 'undefined') return url
  const opened = window.open(url, args.newTab === false ? '_self' : '_blank')
  if (!opened) {
    try { await navigator.clipboard.writeText(url) } catch {}
  }
  return url
}

// -------- Twitter / X --------

export function buildTwitterFreeUrl({
  sentence,
  word,
  link = 'https://madfill.vercel.app/free',
  via,
  hashtags,
}: ShareArgs): string {
  const base = 'https://twitter.com/intent/tweet'
  const { header, quote, filled } = baseLines(sentence, word)
  const tags = normalizeHashtags(['MadFill', 'OnChainGames', ...(Array.isArray(hashtags) ? hashtags : hashtags ? hashtags.split(',') : [])])

  // Reserve space for link (approx), hashtags, and newlines
  const tail = `Play your own here 👉 ${link}`
  const hashLine = tags ? `\n#${tags.split(',').join(' #')}` : ''
  const reservedTail = tail.length + hashLine.length + 2

  const body = `${header}\n\n${quote}\n\n${filled}`
  const bodyTrimmed = truncate(body, LIMITS.twitter, reservedTail)
  const text = `${bodyTrimmed}\n\n${tail}${hashLine}`

  const params = new URLSearchParams({ text })
  if (via) params.set('via', via.replace(/^@/, ''))

  return `${base}?${params.toString()}`
}

export async function shareFreeTweet(args: ShareArgs): Promise<string> {
  const url = buildTwitterFreeUrl(args)
  if (typeof window === 'undefined') return url
  const opened = window.open(url, args.newTab === false ? '_self' : '_blank')
  if (!opened) {
    try { await navigator.clipboard.writeText(url) } catch {}
  }
  return url
}

// -------- Convenience: choose platform --------

export async function shareFree({
  platform = 'warpcast',
  ...rest
}: ShareArgs & { platform?: 'warpcast' | 'twitter' }): Promise<string> {
  return platform === 'twitter' ? shareFreeTweet(rest) : shareFreeCast(rest)
}
