// components/ShareBar.jsx
'use client'

import { useMemo, useState } from 'react'
import { buildShareUrls, openShareWindow, nativeShare, copyToClipboard } from '@/lib/share'

// Tiny helper to build the share text shown in buttons and sent to X/Warpcast.
function buildCaption({ title, theme, feeEth, url }) {
  const bits = []
  if (title) bits.push(`“${title}”`)
  if (theme) bits.push(`#${String(theme).replace(/\s+/g, '')}`)
  if (feeEth) bits.push(`Entry: ${feeEth} ETH + gas`)
  if (url) bits.push(url)
  return bits.join(' • ')
}

export default function ShareBar({
  url = '/',                // relative or absolute; lib/share will normalize
  title = 'MadFill',
  theme = '',
  feeEth = '',
  // extra social knobs
  embeds = [],              // array of URLs to embed in Warpcast (e.g. OG image)
  className = '',
  compact = false,
}) {
  const [copied, setCopied] = useState(false)

  const text = useMemo(
    () => buildCaption({ title, theme, feeEth, url }),
    [title, theme, feeEth, url]
  )

  // Prebuild share URLs (X and Warpcast)
  const { twitter, warpcast } = useMemo(
    () => buildShareUrls({ url, text, embeds }),
    [url, text, embeds]
  )

  const doCopy = async () => {
    const ok = await copyToClipboard(typeof window !== 'undefined'
      ? new URL(url, window.location.origin).toString()
      : url
    )
    setCopied(ok)
    setTimeout(() => setCopied(false), 1200)
  }

  const doWebShare = async () => {
    const didNative = await nativeShare({ title, text, url })
    if (!didNative) await doCopy()
  }

  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900/70 ${compact ? 'p-3' : 'p-4'} ${className}`}>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? 'text-sm' : 'text-base'}`}>
        <span className="font-semibold">Share</span>
        <div className="h-px flex-1 bg-slate-700/70 mx-2" />

        {/* Farcaster / Warpcast */}
        <button
          onClick={() => openShareWindow(warpcast)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-black px-3 py-1.5 transition"
          title="Cast on Farcaster"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-90">
            <path d="M20 2H4a2 2 0 0 0-2 2v16l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" fill="currentColor"/>
          </svg>
          Cast
        </button>

        {/* X / Twitter */}
        <a
          href={twitter}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 transition"
          title="Share on X"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-90">
            <path d="M18.244 3H21l-6.52 7.457L22 21h-5.777l-4.51-5.41L6.55 21H3.79l7.02-8.033L2 3h5.86l4.076 4.957L18.244 3zm-1.01 16h1.57L7.83 5h-1.6l10.997 14z" fill="currentColor"/>
          </svg>
          Post
        </a>

        {/* System Share */}
        <button
          onClick={doWebShare}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 transition"
          title="Share…"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-90">
            <path d="M13 5.828V16a1 1 0 1 1-2 0V5.828L7.929 8.9A1 1 0 1 1 6.515 7.485l5-5a1 1 0 0 1 1.414 0l5 5A1 1 0 0 1 16.485 8.9L13 5.828zM5 20a2 2 0 0 1-2-2v-3a1 1 0 1 1 2 0v3h14v-3a1 1 0 1 1 2 0v3a2 2 0 0 1-2 2H5z" fill="currentColor"/>
          </svg>
          Share
        </button>

        {/* Copy Link */}
        <button
          onClick={doCopy}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 transition"
          title="Copy link"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-90">
            <path d="M3.9 12a5 5 0 0 1 5-5h2v2h-2a3 3 0 0 0 0 6h2v2h-2a5 5 0 0 1-5-5zm7-3h2a5 5 0 1 1 0 10h-2v-2h2a3 3 0 1 0 0-6h-2V9z" fill="currentColor"/>
          </svg>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Caption preview */}
      <div className={`mt-2 text-xs text-slate-400 ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
        {text}
      </div>
    </div>
  )
}
