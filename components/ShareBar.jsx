// components/ShareBar.jsx
'use client'

import { useMemo, useState, useCallback } from 'react'

/**
 * Optional OG config you can pass:
 * og = { title, subtitle, screen, roundId, image }  // `image` lets you override with a direct PNG
 *
 * If `embedUrl` is omitted and `og` is provided, we’ll build:
 *   {origin}/api/og?title=...&subtitle=...&screen=...&roundId=...
 */
function buildEmbedUrl({ embedUrl, og }) {
  if (embedUrl) return embedUrl
  if (!og) return ''

  // Prefer explicit image if provided
  if (og.image) return og.image

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://madfill.vercel.app'

  const params = new URLSearchParams()
  if (og.title) params.set('title', og.title)
  if (og.subtitle) params.set('subtitle', og.subtitle)
  if (og.screen) params.set('screen', og.screen)
  if (og.roundId != null && og.roundId !== '') params.set('roundId', String(og.roundId))

  return `${origin}/api/og?${params.toString()}`
}

function buildShareUrls({ url, text, embedUrl }) {
  const u = encodeURIComponent(url || '')
  const t = encodeURIComponent(text || '')
  const hasEmbed = Boolean(embedUrl)

  // Warpcast supports embeds[]= for rich previews
  const warpcast = hasEmbed
    ? `https://warpcast.com/~/compose?text=${t}%0A${u}&embeds[]=${encodeURIComponent(embedUrl)}`
    : `https://warpcast.com/~/compose?text=${t}%0A${u}`

  // X/Twitter
  const twitter = `https://twitter.com/intent/tweet?text=${t}%0A${u}`

  return { warpcast, twitter }
}

export default function ShareBar({
  url = '',
  text = '',
  embedUrl = '',        // direct image or page url to embed (Warpcast)
  og = null,            // optional { title, subtitle, screen, roundId, image }
  small = false,
  className = '',
}) {
  const [copied, setCopied] = useState(false)

  // If no embedUrl is supplied, try to synthesize one from `og`
  const finalEmbedUrl = useMemo(() => buildEmbedUrl({ embedUrl, og }), [embedUrl, og])
  const hrefs = useMemo(() => buildShareUrls({ url, text, embedUrl: finalEmbedUrl }), [url, text, finalEmbedUrl])

  const pillBase =
    'inline-flex items-center gap-2 rounded-full font-semibold transition ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400 ' +
    'active:scale-[0.98]'

  const pillSize = small ? 'text-xs px-2.5 py-1.5' : 'text-sm px-3.5 py-2'

  const onCopy = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }
    } catch {
      // noop
    }
  }, [url])

  const onNativeShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: text, text, url })
        return
      } catch {
        // fall through to copy
      }
    }
    onCopy()
  }, [text, url, onCopy])

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <a
        href={hrefs.warpcast}
        target="_blank"
        rel="noopener noreferrer"
        className={`${pillBase} ${pillSize} bg-purple-600 hover:bg-purple-500 text-white shadow`}
        aria-label="Share on Warpcast"
        title={finalEmbedUrl ? 'Opens with image embedded' : 'Opens composer'}
      >
        <span aria-hidden>🌀</span>
        <span>Warpcast</span>
      </a>

      <a
        href={hrefs.twitter}
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
