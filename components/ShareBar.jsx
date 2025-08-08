// components/ShareBar.jsx
'use client'

import { useState } from 'react'
import { buildShareUrls, copyToClipboard, nativeShare } from '@/lib/share'

export default function ShareBar({ url, text, embedUrl, small = false, className = '' }) {
  const [copied, setCopied] = useState(false)
  const hrefs = buildShareUrls({ url, text, embed: embedUrl })

  const baseBtn = small
    ? 'text-xs px-2 py-1 rounded underline'
    : 'text-sm px-3 py-1 rounded underline'

  async function onCopy() {
    if (await copyToClipboard(url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  async function onNativeShare() {
    const ok = await nativeShare({ title: text, text, url })
    if (!ok) onCopy()
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className={small ? 'text-xs text-slate-400' : 'text-sm text-slate-400'}>Share:</span>
      <a
        href={hrefs.twitter}
        target="_blank"
        rel="noreferrer"
        className={`${baseBtn} text-blue-400`}
        aria-label="Share on Twitter/X"
      >
        Twitter
      </a>
      <a
        href={hrefs.warpcast}
        target="_blank"
        rel="noreferrer"
        className={`${baseBtn} text-purple-300`}
        aria-label="Share on Warpcast"
      >
        Warpcast
      </a>
      <button onClick={onCopy} className={`${baseBtn} text-slate-200`} aria-label="Copy link">
        {copied ? 'Copied ✓' : 'Copy link'}
      </button>
      <button onClick={onNativeShare} className={`${baseBtn} text-cyan-300`} aria-label="Share">
        Share…
      </button>
    </div>
  )
}
