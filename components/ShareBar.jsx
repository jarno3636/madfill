// components/ShareBar.jsx
'use client'

import {
  FacebookShareButton,
  TwitterShareButton,
  TelegramShareButton,
  FacebookIcon,
  TwitterIcon,
  TelegramIcon,
} from 'react-share'
import { absoluteUrl } from '@/lib/seo'

/**
 * Lightweight social share bar with safe fallbacks.
 *
 * Props:
 * - url: string (absolute or relative)
 * - title: string (tweet text / fb quote)
 * - text: string (optional extra body for navigator.share / clipboard)
 * - hashtags: string[] (twitter only)
 * - small: boolean (render 28px icons instead of 32px)
 * - og: object (optional, reserved for future OG param plumbing)
 * - className: string
 */
export default function ShareBar({
  url,
  title = 'Check out MadFill!',
  text = '',
  hashtags = ['MadFill', 'Base', 'Farcaster'],
  small = false,
  // eslint-disable-next-line no-unused-vars
  og = undefined, // accepted for API compatibility; not used here
  className = '',
}) {
  // Resolve to absolute for consistent previews/webviews
  const shareUrl = absoluteUrl(url || 'https://madfill.vercel.app')
  const size = small ? 28 : 32

  async function handleShareClick() {
    const body = [title, text].filter(Boolean).join('\n\n')
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title,
          text: body,
          url: shareUrl,
        })
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText([body, shareUrl].filter(Boolean).join('\n\n'))
        // TODO: integrate app toast/snackbar (useToast) instead of console
        console.info('Share link copied to clipboard')
        return
      }
    } catch (err) {
      // fall through to no-op; buttons below still work
      console.error('Share failed:', err)
    }
  }

  // Guard hashtags to array of strings
  const hashList = Array.isArray(hashtags) ? hashtags.filter(Boolean).map(String) : []

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-purple-200 mr-2">Share:</span>

      <TwitterShareButton
        url={shareUrl}
        title={title}
        hashtags={hashList}
        className="hover:scale-110 transition-transform"
        aria-label="Share on Twitter/X"
      >
        <TwitterIcon size={size} round />
      </TwitterShareButton>

      <FacebookShareButton
        url={shareUrl}
        quote={title}
        className="hover:scale-110 transition-transform"
        aria-label="Share on Facebook"
      >
        <FacebookIcon size={size} round />
      </FacebookShareButton>

      <TelegramShareButton
        url={shareUrl}
        title={title}
        className="hover:scale-110 transition-transform"
        aria-label="Share on Telegram"
      >
        <TelegramIcon size={size} round />
      </TelegramShareButton>

      <button
        onClick={handleShareClick}
        className={`rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white hover:scale-110 transition-all ${
          small ? 'w-7 h-7 text-[13px]' : 'w-8 h-8 text-[14px]'
        }`}
        title="Share or Copy Link"
        aria-label="Share or copy link"
        type="button"
      >
        📋
      </button>
    </div>
  )
}
