// components/ShareBar.jsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { absoluteUrl } from '@/lib/seo'

/**
 * SSR-safe ShareBar:
 * - Avoids importing `react-share` at module scope (some adapters break during export)
 * - Dynamically loads buttons/icons on the client; SSR renders a simple copy/share button
 */
export default function ShareBar({
  url,
  title = 'Check out MadFill!',
  hashtags = ['MadFill', 'Base', 'Farcaster'],
  className = '',
}) {
  const shareUrl = absoluteUrl(url || 'https://madfill.vercel.app')

  const [lib, setLib] = useState(null)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('react-share')
        if (mounted) setLib(mod)
      } catch {
        // ignore; fallback UI will be shown
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleShareClick = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, url: shareUrl })
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl)
        // TODO: swap for toast/snackbar
        console.info('URL copied to clipboard')
      }
    } catch (err) {
      console.error('Share failed:', err)
    }
  }

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

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-purple-200 mr-2">Share:</span>

      {Buttons ? (
        <>
          <Buttons.TwitterShareButton
            url={shareUrl}
            title={title}
            hashtags={hashtags}
            className="hover:scale-110 transition-transform"
          >
            <Buttons.TwitterIcon size={32} round alt="Share on Twitter" />
          </Buttons.TwitterShareButton>

          <Buttons.FacebookShareButton
            url={shareUrl}
            quote={title}
            className="hover:scale-110 transition-transform"
          >
            <Buttons.FacebookIcon size={32} round alt="Share on Facebook" />
          </Buttons.FacebookShareButton>

          <Buttons.TelegramShareButton
            url={shareUrl}
            title={title}
            className="hover:scale-110 transition-transform"
          >
            <Buttons.TelegramIcon size={32} round alt="Share on Telegram" />
          </Buttons.TelegramShareButton>
        </>
      ) : null}

      <button
        onClick={handleShareClick}
        className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white hover:scale-110 transition-all"
        title="Share or Copy Link"
        aria-label="Share or copy link"
      >
        📋
      </button>
    </div>
  )
}
