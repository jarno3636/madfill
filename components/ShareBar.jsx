'use client'

import { useMemo, useState, useCallback } from 'react'

/** Detect Warpcast / Farcaster host */
function isFarcasterUA() {
  if (typeof navigator === 'undefined') return false
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent)
}

/** Farcaster-aware base (set NEXT_PUBLIC_FC_MINIAPP_URL once in Vercel) */
function getMiniAppBase() {
  const env = (process.env.NEXT_PUBLIC_FC_MINIAPP_URL || '').replace(/\/+$/, '')
  return env || 'https://farcaster.xyz/miniapps/k_MpThP1sYRl/madfill'
}

/** Web site base (SSR-safe) */
function getSiteBase() {
  const env = (process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app').replace(/\/+$/, '')
  return env
}

/** Make absolute against a specific base (SSR/browser safe) */
function toAbsolute(pathOrUrl, base) {
  if (!pathOrUrl) return base
  try {
    return new URL(pathOrUrl).toString() // already absolute
  } catch {
    return new URL(pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`, base).toString()
  }
}

/** Safe absolute URL helper (defaults to web base) */
function ensureAbsolute(url) {
  return toAbsolute(url || '/', getSiteBase())
}

/** Farcaster-aware target for the *link you place in the cast* */
function fcTarget(urlOrPath) {
  const base = isFarcasterUA() ? getMiniAppBase() : getSiteBase()
  return toAbsolute(urlOrPath || '/', base)
}

/** Build a /api/og PNG URL from props (absolute to web base) */
function buildOgUrl(og) {
  if (!og) return ''
  const qp = new URLSearchParams()
  if (og.title) qp.set('title', og.title)
  if (og.subtitle) qp.set('subtitle', og.subtitle)
  if (og.screen) qp.set('screen', og.screen)
  if (og.roundId !== undefined && og.roundId !== null) qp.set('roundId', String(og.roundId))
  return toAbsolute(`/api/og?${qp.toString()}`, getSiteBase())
}

/** Build share URLs for Warpcast & Twitter/X */
function buildShareUrls({ url, text, embedUrl, og, hashtags }) {
  // URL **in the cast text**: Farcaster-aware (mini app base inside Warpcast)
  const castUrl = fcTarget(url || '/')

  // Embed image: absolute web URL for stability
  const autoOg = buildOgUrl(og)
  const embed = embedUrl ? ensureAbsolute(embedUrl) : autoOg

  const t = text ? encodeURIComponent(text) : ''
  const hash = Array.isArray(hashtags) && hashtags.length
    ? `&hashtags=${encodeURIComponent(hashtags.join(','))}`
    : ''

  // Warpcast compose — keep one embed to ensure stable preview
  const warpcast = embed
    ? `https://warpcast.com/~/compose?text=${t}%0A${encodeURIComponent(castUrl)}&embeds[]=${encodeURIComponent(embed)}`
    : `https://warpcast.com/~/compose?text=${t}%0A${encodeURIComponent(castUrl)}`

  // X/Twitter (use web URL)
  const twitter = `https://twitter.com/intent/tweet?text=${t}%0A${encodeURIComponent(ensureAbsolute(url || '/'))}${hash}`

  return { warpcast, twitter, embedUsed: embed }
}

export default function ShareBar({
  url = '',
  text = '',
  embedUrl = '',      // manual image embed (kept)
  og = null,          // { title, subtitle, screen, roundId } -> auto OG via /api/og
  hashtags = [],
  small = false,
  className = '',
}) {
  const [copied, setCopied] = useState(false)

  const { warpcast, twitter, embedUsed } = useMemo(
    () => buildShareUrls({ url, text, embedUrl, og, hashtags }),
    [url, text, embedUrl, og, hashtags]
  )

  const pillBase =
    'inline-flex items-center gap-2 rounded-full font-semibold transition ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400 ' +
    'active:scale-[0.98]'
  const pillSize = small ? 'text-xs px-2.5 py-1.5' : 'text-sm px-3.5 py-2'

  const onCopy = useCallback(async () => {
    try {
      const target = fcTarget(url || '/')
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(target)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }
    } catch { /* noop */ }
  }, [url])

  const onNativeShare = useCallback(async () => {
    const target = fcTarget(url || '/')
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: text, text, url: target })
        return
      } catch { /* fall through */ }
    }
    onCopy()
  }, [text, url, onCopy])

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <a
        href={warpcast}
        target="_blank"
        rel="noopener noreferrer"
        className={`${pillBase} ${pillSize} bg-purple-600 hover:bg-purple-500 text-white shadow`}
        aria-label="Share on Warpcast"
        title={embedUsed ? 'Opens Warpcast with image embed' : 'Opens Warpcast'}
      >
        <span aria-hidden>🌀</span>
        <span>Warpcast</span>
      </a>

      <a
        href={twitter}
        target="_blank"
        rel="noopener noreferrer"
        className={`${pillBase} ${pillSize} bg-blue-600 hover:bg-blue-500 text-white shadow`}
        aria-label="Share on X (Twitter)"
      >
        <span aria-hidden>🐦</span>
        <span>Tweet</span>
      </a>

      <button
        type="button"
        onClick={onNativeShare}
        className={`${pillBase} ${pillSize} bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600`}
        aria-label="Share (native) or copy link"
      >
        <span aria-hidden>🔗</span>
        <span>{copied ? 'Copied!' : 'Share / Copy'}</span>
      </button>

      {/* a11y live region for copy feedback */}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </div>
  )
}
