// components/ShareBar.jsx
'use client'

import { useMemo } from 'react'
import {
  buildXIntentUrl,
  openWarpcastCompose,
  nativeShare,
  copyToClipboard,
  safeAbsoluteUrl,
} from '@/lib/share'

/**
 * Minimal, reliable ShareBar that:
 * - Opens Warpcast compose in-app via the Mini App SDK when available
 * - Falls back to web compose in a popup (no download page redirect)
 * - Provides X intent + native share + copy fallback
 *
 * Props:
 *   url: string (can be relative)
 *   text: string (cast body / tweet text; URL will be appended if not present)
 *   embeds: string[] (absolute/relative URLs to embed in Warpcast)
 */
export default function ShareBar({
  url = '/',
  text = 'Fill the blank with me on MadFill!',
  embeds = [],
  className = '',
  onShared, // optional callback
}) {
  const shareUrl = useMemo(() => safeAbsoluteUrl(url), [url])

  async function handleCast() {
    const ok = await openWarpcastCompose({ text, url: shareUrl, embeds })
    if (!ok) {
      // As a last resort, try native share or copy
      const didNative = await nativeShare({ title: 'MadFill', text, url: shareUrl })
      if (!didNative) await copyToClipboard(`${text} ${shareUrl}`.trim())
    }
    onShared?.('warpcast')
  }

  function handleX() {
    const href = buildXIntentUrl({ text, url: shareUrl })
    // open in popup
    window?.open?.(href, '_blank', 'noopener,noreferrer,width=680,height=760')
    onShared?.('x')
  }

  async function handleCopy() {
    const ok = await copyToClipboard(shareUrl)
    if (!ok) {
      // soft fallback: open the URL so users can copy from the bar
      window?.open?.(shareUrl, '_blank', 'noopener,noreferrer')
    }
    onShared?.('copy')
  }

  async function handleNative() {
    const ok = await nativeShare({ title: 'MadFill', text, url: shareUrl })
    if (!ok) await handleCopy()
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-purple-200 mr-1">Share:</span>

      {/* Cast (Warpcast) */}
      <button
        onClick={handleCast}
        className="px-3 h-9 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-all"
        title="Cast on Warpcast"
      >
        ✨ Cast
      </button>

      {/* X / Twitter */}
      <button
        onClick={handleX}
        className="px-3 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-all"
        title="Share on X"
      >
        𝕏
      </button>

      {/* Native share (mobile) */}
      <button
        onClick={handleNative}
        className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white transition-all"
        title="Share"
        aria-label="Share"
      >
        📤
      </button>

      {/* Copy fallback */}
      <button
        onClick={handleCopy}
        className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white transition-all"
        title="Copy link"
        aria-label="Copy link"
      >
        📋
      </button>
    </div>
  )
}
