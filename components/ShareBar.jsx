// components/ShareBar.jsx
'use client'

import { useState, useCallback } from 'react'

function buildShareUrls({ url, text }) {
  const u = encodeURIComponent(url || '')
  const t = encodeURIComponent(text || '')
  return {
    twitter: `https://twitter.com/intent/tweet?text=${t}%0A${u}`,
    warpcast: `https://warpcast.com/~/compose?text=${t}%0A${u}`,
  }
}

export default function ShareBar({
  url = '',
  text = '',
  small = false,
  className = '',
}) {
  const [copied, setCopied] = useState(false)
  const hrefs = buildShareUrls({ url, text })

  const pill =
    'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ' +
    (small ? 'text-xs px-2 py-1' : '')

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }, [url])

  const onNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url })
        return
      } catch {}
    }
    onCopy()
  }, [text, url, onCopy])

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <a
        href={hrefs.warpcast}
        target="_blank"
        rel="noreferrer"
        className={`${pill} bg-purple-600 hover:bg-purple-500 text-white shadow`}
        aria-label="Share on Warpcast"
      >
        🌀 <span>Warpcast</span>
      </a>
      <a
        href={hrefs.twitter}
        target="_blank"
        rel="noreferrer"
        className={`${pill} bg-blue-600 hover:bg-blue-500 text-white shadow`}
        aria-label="Share on Twitter/X"
      >
        🐦 <span>Tweet</span>
      </a>
      <button
        onClick={onNativeShare}
        className={`${pill} bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600`}
        aria-label="Share or copy"
      >
        {copied ? '✓ Copied' : '🔗 Share / Copy'}
      </button>
    </div>
  )
}
