// components/ShareBar.jsx
'use client'

import {
  FacebookShareButton,
  TwitterShareButton,
  TelegramShareButton,
  FacebookIcon,
  TwitterIcon,
  TelegramIcon
} from 'react-share'
import { absoluteUrl } from '@/lib/seo'

export default function ShareBar({
  url,
  title = 'Check out MadFill!',
  hashtags = ['MadFill', 'Base', 'Farcaster'],
  className = ''
}) {
  const shareUrl = absoluteUrl(url || 'https://madfill.vercel.app')

  const handleShareClick = () => {
    if (typeof navigator !== 'undefined') {
      if (navigator.share) {
        navigator.share({
          title,
          url: shareUrl
        }).catch((err) => {
          console.error('Share failed:', err)
        })
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl)
          .then(() => {
            // TODO: Replace with toast/snackbar system
            console.info('URL copied to clipboard')
          })
          .catch((err) => {
            console.error('Copy failed:', err)
          })
      }
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-purple-200 mr-2">Share:</span>

      <TwitterShareButton
        url={shareUrl}
        title={title}
        hashtags={hashtags}
        className="hover:scale-110 transition-transform"
      >
        <TwitterIcon size={32} round alt="Share on Twitter" />
      </TwitterShareButton>

      <FacebookShareButton
        url={shareUrl}
        quote={title}
        className="hover:scale-110 transition-transform"
      >
        <FacebookIcon size={32} round alt="Share on Facebook" />
      </FacebookShareButton>

      <TelegramShareButton
        url={shareUrl}
        title={title}
        className="hover:scale-110 transition-transform"
      >
        <TelegramIcon size={32} round alt="Share on Telegram" />
      </TelegramShareButton>

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
