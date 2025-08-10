'use client'

import { useMemo, useState, useCallback } from 'react'

/** Safe absolute URL helper (needed for Warpcast embeds) */
function ensureAbsolute(url) {
  if (!url) return ''
  try {
    // If already absolute, URL() won’t throw
    return new URL(url).toString()
  } catch {
    const origin =
      (typeof window !== 'undefined' && window.location?.origin) ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://madfill.vercel.app'
    return new URL(url, origin).toString()
  }
}

/** Build a /api/og PNG URL from props */
function buildOgUrl(og) {
  if (!og) return ''
  const qp = new URLSearchParams()
  if (og.title) qp.set('title', og.title)
  if (og.subtitle) qp.set('subtitle', og.subtitle)
  if (og.screen) qp.set('screen', og.screen)
  if (og.roundId) qp.set('roundId', String(og.roundId))
  return ensureAbsolute(`/api/og?${qp.toString()}`)
}

/** Build share URLs for Warpcast & Twitter/X */
function buildShareUrls({ url, text, embedUrl, og, hashtags }) {
  const absoluteUrl = ensureAbsolute(url || '')
  const t = text ? encodeURIComponent(text) : ''
  const tags = Array.isArray(hashtags) && hashtags.length
    ? `&hashtags=${encodeURIComponent(hashtags.join(','))}`
    : ''

  const autoOg = buildOgUrl(og)
  const embed = embedUrl ? ensureAbsolute(embedUrl) : autoOg

  // Warpcast allows multiple embeds[] — keep single by default (stable preview)
  const warpcast = embed
    ? `https://warpcast.com/~/compose?text=${t}%0A${encodeURIComponent(absoluteUrl)}&embeds[]=${encodeURIComponent(embed)}`
    : `https://warpcast.com/~/compose?text=${t}%0A${encodeURIComponent(absoluteUrl)}`

  // X/Twitter
  const twitter = `https://twitter.com/intent/tweet?text=${t}%0A${encodeURIComponent(absoluteUrl)}${tags}`

  return { warpcast, twitter, embedUsed: embed }
}

export default function ShareBar({
  url = '',
  text = '',
  embedUrl = '',      // manual image embed (kept for backward-compat)
  og = null,          // { title, subtitle, screen, roundId } -> auto OG via /api/og
  hashtags = [],      // NEW: array of strings for X/Twitter
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
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(ensureAbsolute(url))
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }
    } catch { /* noop */ }
  }, [url])

  const onNativeShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: text, text, url: ensureAbsolute(url) })
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
