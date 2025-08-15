// components/ShareBar.jsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildShareUrls,
  buildWarpcastCompose,
  openWarpcastComposeUrl,
  nativeShare,
  copyToClipboard,
} from '@/lib/share'

/**
 * SSR-safe ShareBar:
 * - Dynamically loads `react-share` on client only.
 * - "Cast" button opens Warpcast composer via Farcaster Mini App SDK when available.
 */
export default function ShareBar({
  url,
  title = 'Check out MadFill!',
  text,                 // optional: custom text for X/Warpcast; falls back to title
  embeds = [],          // optional: array of URLs to embed on Warpcast
  hashtags = ['MadFill', 'Base', 'Farcaster'],
  className = '',
  onShared,             // optional callback after a share/copy attempt
}) {
  const shareText = text || title
  const { twitter, warpcast } = useMemo(
    () => buildShareUrls({ url, text: shareText, embeds }),
    [url, shareText, embeds]
  )

  // Load react-share only on client
  const [lib, setLib] = useState(null)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('react-share')
        if (mounted) setLib(mod)
      } catch {
        // ignore; fallback UI remains
      }
    })()
    return () => { mounted = false }
  }, [])

  const Buttons = useMemo(() => {
    if (!lib) return null
    const {
      FacebookShareButton,
      TwitterShareButton,
      TelegramShareButton,
      FacebookIcon,
      TwitterIcon,
      TelegramIcon,
    } = lib
    return {
      FacebookShareButton,
      TwitterShareButton,
      TelegramShareButton,
      FacebookIcon,
      TwitterIcon,
      TelegramIcon,
    }
  }, [lib])

  const handleNativeShareOrCopy = async () => {
    const opened = await nativeShare({ title: shareText, url })
    if (!opened) {
      const ok = await copyToClipboard(url)
      if (ok) {
        // replace with your toast system if available
        console.info('Link copied to clipboard')
      }
    }
    onShared?.('native_or_copy')
  }

  const handleCast = async () => {
    const composeUrl = buildWarpcastCompose({ text: shareText, url, embeds })
    await openWarpcastComposeUrl(composeUrl)
    onShared?.('warpcast')
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-purple-200 mr-2">Share:</span>

      {/* X / Twitter */}
      {Buttons ? (
        <Buttons.TwitterShareButton
          url={url}
          title={shareText}
          hashtags={hashtags}
          className="hover:scale-110 transition-transform"
        >
          <Buttons.TwitterIcon size={32} round alt="Share on X" />
        </Buttons.TwitterShareButton>
      ) : null}

      {/* Facebook */}
      {Buttons ? (
        <Buttons.FacebookShareButton
          url={url}
          quote={shareText}
          className="hover:scale-110 transition-transform"
        >
          <Buttons.FacebookIcon size={32} round alt="Share on Facebook" />
        </Buttons.FacebookShareButton>
      ) : null}

      {/* Telegram */}
      {Buttons ? (
        <Buttons.TelegramShareButton
          url={url}
          title={shareText}
          className="hover:scale-110 transition-transform"
        >
          <Buttons.TelegramIcon size={32} round alt="Share on Telegram" />
        </Buttons.TelegramShareButton>
      ) : null}

      {/* Warpcast (Farcaster) — Mini App–aware */}
      <button
        onClick={handleCast}
        className="inline-flex items-center gap-2 rounded-full bg-violet-500 hover:bg-violet-400 text-black px-3 py-1.5 transition"
        title="Cast on Farcaster"
        aria-label="Cast on Farcaster"
      >
        {/* Simple Warpcast glyph (W) */}
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/20 font-bold">W</span>
        <span className="text-sm font-semibold">Cast</span>
      </button>

      {/* Native share / copy fallback */}
      <button
        onClick={handleNativeShareOrCopy}
        className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white hover:scale-110 transition-all"
        title="Share or Copy Link"
        aria-label="Share or copy link"
      >
        📋
      </button>
    </div>
  )
}
