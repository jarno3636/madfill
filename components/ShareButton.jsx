// components/ShareButton.jsx
'use client'

import { useCallback, useMemo, useState } from 'react'

const FC_LIMIT = 320

// --- helpers ---
function getOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'
}

function absolutize(u) {
  if (!u) return ''
  try {
    return new URL(u, getOrigin()).toString()
  } catch {
    return ''
  }
}

function buildOgUrl(og) {
  if (!og) return ''
  const qp = new URLSearchParams()
  if (og.title) qp.set('title', og.title)
  if (og.subtitle) qp.set('subtitle', og.subtitle)
  if (og.screen) qp.set('screen', og.screen)
  if (og.roundId) qp.set('roundId', String(og.roundId))
  return `${getOrigin()}/api/og?${qp.toString()}`
}

function warpcastComposeUrl({ text, url, embed }) {
  const t = encodeURIComponent(text || '')
  const u = encodeURIComponent(url || '')
  if (embed) {
    return `https://warpcast.com/~/compose?text=${t}%0A${u}&embeds[]=${encodeURIComponent(embed)}`
  }
  return `https://warpcast.com/~/compose?text=${t}%0A${u}`
}

function truncateForFC(text) {
  if (!text) return ''
  if (text.length <= FC_LIMIT) return text
  const cutoff = FC_LIMIT - 1
  const slice = text.slice(0, cutoff)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…'
}

export default function ShareButton({
  sentence,
  word, // kept for API compatibility
  variant = 'farcaster',
  url = 'https://madfill.vercel.app',
  labelOverride,
  embedUrl,
  og, // { title, subtitle, screen, roundId }
  hashtags = '',
}) {
  const [busy, setBusy] = useState(false)

  const embed = useMemo(() => absolutize(embedUrl || buildOgUrl(og)), [embedUrl, og])
  const safeUrl = useMemo(() => absolutize(url), [url])

  const baseText = useMemo(() => {
    const parts = [sentence || '', safeUrl || '']
    if (hashtags) parts.push(hashtags)
    return truncateForFC(parts.filter(Boolean).join('\n'))
  }, [sentence, safeUrl, hashtags])

  const doShareFarcaster = useCallback(async () => {
    setBusy(true)
    try {
      const inWarpcast = typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)

      if (inWarpcast) {
        try {
          const mod = await import('@farcaster/frame-sdk')
          const { sdk } = mod
          if (sdk?.actions?.share) {
            await sdk.actions.share({ text: baseText, embeds: embed ? [embed] : [] })
            return
          }
          if (sdk?.actions?.openUrl) {
            await sdk.actions.openUrl(warpcastComposeUrl({ text: baseText, url: safeUrl, embed }))
            return
          }
        } catch {
          // fall through
        }
      }

      const win = window.open(
        warpcastComposeUrl({ text: baseText, url: safeUrl, embed }),
        '_blank',
        'noopener,noreferrer'
      )
      if (!win && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(
          warpcastComposeUrl({ text: baseText, url: safeUrl, embed })
        )
        alert('Composer link copied to clipboard ✅')
      }
    } finally {
      setBusy(false)
    }
  }, [baseText, safeUrl, embed])

  const doShareTwitter = useCallback(() => {
    const t = encodeURIComponent(baseText)
    window.open(
      `https://twitter.com/intent/tweet?text=${t}`,
      '_blank',
      'noopener,noreferrer'
    )
  }, [baseText])

  const doCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(baseText)
      alert('Link copied to clipboard ✅')
    } catch {
      alert('Copy failed. Please try again.')
    }
  }, [baseText])

  const handleClick = useCallback(async () => {
    try {
      if (variant === 'farcaster') return doShareFarcaster()
      if (variant === 'twitter') return doShareTwitter()
      if (variant === 'copy') return doCopy()
    } catch (err) {
      console.warn(`ShareButton ${variant} failed:`, err)
      alert('Sharing failed. Please try again.')
    }
  }, [variant, doShareFarcaster, doShareTwitter, doCopy])

  const label =
    labelOverride ||
    {
      farcaster: '🌀 Share on Farcaster',
      twitter: '🐦 Share on Twitter',
      copy: '📋 Copy Link',
    }[variant] ||
    'Share'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`flex items-center justify-center gap-2 px-4 py-2 mt-4
        ${variant === 'twitter' ? 'bg-blue-600 hover:bg-blue-500' :
          variant === 'copy' ? 'bg-slate-800 hover:bg-slate-700 border border-slate-600' :
          'bg-indigo-600 hover:bg-indigo-500'}
        active:bg-indigo-700 text-white font-semibold rounded-full shadow-lg
        transition-all duration-200 hover:shadow-xl active:scale-95
        text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed`}
      aria-label={label}
    >
      {busy ? 'Sharing…' : label}
    </button>
  )
}
