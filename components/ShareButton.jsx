// components/ShareButton.jsx
'use client'

import { useCallback, useMemo, useState } from 'react'

// --- tiny helpers (no external deps) ---
function getOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'
}

function buildOgUrl(og) {
  if (!og) return ''
  const base = getOrigin()
  const qp = new URLSearchParams()
  if (og.title) qp.set('title', og.title)
  if (og.subtitle) qp.set('subtitle', og.subtitle)
  if (og.screen) qp.set('screen', og.screen)
  if (og.roundId) qp.set('roundId', String(og.roundId))
  return `${base}/api/og?${qp.toString()}`
}

function warpcastComposeUrl({ text, url, embed }) {
  const t = encodeURIComponent(text || '')
  const u = encodeURIComponent(url || '')
  if (embed) {
    return `https://warpcast.com/~/compose?text=${t}%0A${u}&embeds[]=${encodeURIComponent(embed)}`
  }
  return `https://warpcast.com/~/compose?text=${t}%0A${u}`
}

export default function ShareButton({
  sentence,
  word,
  variant = 'farcaster',
  url = 'https://madfill.vercel.app',
  labelOverride,
  // Optional: pass an embed image directly or describe one to auto-generate via /api/og
  embedUrl,
  og, // { title, subtitle, screen, roundId }
  // Optional hashtags string, e.g. "#MadFill #Base"
  hashtags = '',
}) {
  const [busy, setBusy] = useState(false)

  const embed = useMemo(() => embedUrl || buildOgUrl(og), [embedUrl, og])

  const baseText = useMemo(() => {
    const parts = [sentence || '', url || '']
    if (hashtags) parts.push(hashtags)
    return parts.filter(Boolean).join('\n')
  }, [sentence, url, hashtags])

  const doShareFarcaster = useCallback(async () => {
    setBusy(true)
    try {
      // Detect Warpcast Mini App (very light)
      const inWarpcast =
        typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)

      if (inWarpcast) {
        // Try the Frame SDK first (mini app native share)
        try {
          const mod = await import('@farcaster/frame-sdk')
          const { sdk } = mod
          // Prefer native share if available
          if (sdk?.actions?.share) {
            await sdk.actions.share({
              text: baseText,
              embeds: embed ? [embed] : [],
            })
            setBusy(false)
            return
          }
          // Fallback: open Warpcast composer inside app
          if (sdk?.actions?.openUrl) {
            await sdk.actions.openUrl(
              warpcastComposeUrl({ text: baseText, url, embed })
            )
            setBusy(false)
            return
          }
        } catch {
          // fall through to browser compose
        }
      }

      // Browser fallback: open web composer
      window.open(
        warpcastComposeUrl({ text: baseText, url, embed }),
        '_blank',
        'noopener,noreferrer'
      )
    } finally {
      setBusy(false)
    }
  }, [baseText, url, embed])

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
