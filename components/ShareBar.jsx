// components/ShareBar.jsx
'use client'

import { useMemo, useEffect, useState, useCallback } from 'react'
import { absoluteUrl } from '@/lib/seo'
import {
  shareToWarpcast,
  buildCastText,
  buildShareUrls,
  copyToClipboard,
} from '@/lib/share'

/**
 * Props:
 *  - url (string)           : round URL (relative or absolute)
 *  - title (string)         : cast title/lead
 *  - theme (string)
 *  - templateName (string)
 *  - feeEth (string|number)
 *  - durationMins (number)
 *  - word (string)
 *  - blankIndex (number)    : which blank they filled (0-based)
 *  - hashtags (string[])
 *  - embed (string|string[]) : OG image(s) to attach on Farcaster
 */
export default function ShareBar({
  url,
  title = '🧠 Play MadFill!',
  theme,
  templateName,
  feeEth,
  durationMins,
  word,
  blankIndex,
  hashtags = ['MadFill', 'Base', 'Farcaster'],
  embed,
  className = '',
}) {
  const shareUrl = useMemo(() => absoluteUrl(url || '/'), [url])
  const embeds = useMemo(() => (embed ? (Array.isArray(embed) ? embed : [embed]) : []), [embed])
  const blankLabel = typeof blankIndex === 'number' ? `Blank #${blankIndex + 1}` : ''

  // Text we’ll also reuse for X/Telegram
  const castText = useMemo(() => {
    return buildCastText({
      style: 'playful',
      url: shareUrl,
      word,
      blankLabel,
      title,
      theme,
      templateName,
      feeEth,
      durationMins,
      hashtagList: hashtags,
    })
  }, [shareUrl, word, blankLabel, title, theme, templateName, feeEth, durationMins, hashtags])

  // Build intent URLs for non-Farcaster buttons (web only)
  const intents = useMemo(
    () => buildShareUrls({ url: shareUrl, text: castText, embeds }),
    [shareUrl, castText, embeds]
  )

  const handleCast = useCallback(async () => {
    await shareToWarpcast({
      style: 'playful',
      url: shareUrl,
      word,
      blankLabel,
      title,
      theme,
      templateName,
      feeEth,
      durationMins,
      hashtagList: hashtags,
      embeds,
      // forceMini: false, // uncomment to force mini deep-link even on web
    })
  }, [shareUrl, word, blankLabel, title, theme, templateName, feeEth, durationMins, hashtags, embeds])

  // Optional: lazy-load react-share icons/buttons for web
  const [RS, setRS] = useState(null)
  useEffect(() => {
    let on = true
    ;(async () => {
      try {
        const mod = await import('react-share')
        if (on) setRS(mod)
      } catch {}
    })()
    return () => { on = false }
  }, [])

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleCast}
        className="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-semibold shadow transition"
        aria-label="Share on Farcaster"
        title="Share on Farcaster"
      >
        ✨ Cast
      </button>

      {RS && (
        <>
          <RS.TwitterShareButton url={intents.twitter} title={castText} className="hover:scale-110 transition-transform">
            <RS.TwitterIcon size={32} round alt="Share on X" />
          </RS.TwitterShareButton>

          <RS.TelegramShareButton url={shareUrl} title={castText} className="hover:scale-110 transition-transform">
            <RS.TelegramIcon size={32} round alt="Share on Telegram" />
          </RS.TelegramShareButton>
        </>
      )}

      <button
        onClick={async () => { await copyToClipboard(shareUrl) }}
        className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white hover:scale-110 transition-all"
        title="Copy link"
        aria-label="Copy link"
      >
        📋
      </button>
    </div>
  )
}
