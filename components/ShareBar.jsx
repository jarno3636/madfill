// components/ShareBar.jsx
'use client'

import { useEffect, useId, useState } from 'react'
import { buildShareUrls, copyToClipboard, nativeShare } from '@/lib/share'

export default function ShareBar({
  url = '',
  text = 'Check this out',
  embedUrl = '',
  small = false,
  className = '',
}) {
  const [copied, setCopied] = useState(false)
  const [hrefs, setHrefs] = useState(() => buildShareUrls({ url, text, embed: embedUrl }))
  const liveId = useId()

  // Recompute hrefs if props change
  useEffect(() => {
    setHrefs(buildShareUrls({ url, text, embed: embedUrl }))
  }, [url, text, embedUrl])

  const baseBtn = small
    ? 'text-xs px-2 py-1 rounded underline'
    : 'text-sm px-3 py-1 rounded underline'

  async function onCopy() {
    const ok = await copyToClipboard(url)
    setCopied(Boolean(ok))
    if (ok) setTimeout(() => setCopied(false), 1500)
  }

  async function onNativeShare() {
    const ok = await nativeShare({ title: text, text, url })
    if (!ok) onCopy()
  }

  const disabled = !url

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className={small ? 'text-xs text-slate-400' : 'text-sm text-slate-400'}>Share:</span>

      <a
        href={hrefs.twitter}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseBtn} text-blue-400 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        aria-label="Share on Twitter / X"
      >
        Twitter
      </a>

      <a
        href={hrefs.warpcast}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseBtn} text-purple-300 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        aria-label="Share on Warpcast"
      >
        Warpcast
      </a>

      <button
        type="button"
        onClick={onCopy}
        disabled={disabled}
        className={`${baseBtn} text-slate-200 disabled:opacity-50`}
        aria-label="Copy link"
        aria-describedby={liveId}
      >
        {copied ? 'Copied ✓' : 'Copy link'}
      </button>

      <button
        type="button"
        onClick={onNativeShare}
        disabled={disabled}
        className={`${baseBtn} text-cyan-300 disabled:opacity-50`}
        aria-label="Share"
      >
        Share…
      </button>

      {/* polite ARIA live region for copied status */}
      <span id={liveId} className="sr-only" aria-live="polite">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </div>
  )
}
