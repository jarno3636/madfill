// components/ShareBar.jsx
'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { absoluteUrl } from '@/lib/seo'
import {
  buildShareUrls,
  buildWarpcastCompose,
  openShareWindow,
  copyToClipboard,
  nativeShare,
} from '@/lib/share'

/**
 * ShareBar
 * - Detects Farcaster Mini App and uses the in-app composer.
 * - Otherwise prefers Web Share, then popup intent, then clipboard.
 *
 * Props you can pass:
 *  - url (string)           : round URL (relative or absolute)
 *  - title (string)         : cast title/lead
 *  - theme (string)         : e.g. "Comedy"
 *  - templateName (string)  : e.g. "Crypto Chaos"
 *  - feeEth (string)        : e.g. "0.0005"
 *  - durationMins (number)  : e.g. 60
 *  - word (string)          : optional word
 *  - blankIndex (number)    : which blank they filled
 *  - hashtags (string[])    : e.g. ['MadFill','Base','Farcaster']
 *  - embed (string|array)   : OG image(s) to attach inside Farcaster
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
  // Normalize URL early so all paths use the same absolute link
  const shareUrl = useMemo(() => absoluteUrl(url || '/'), [url])

  // ======== Detect Farcaster Mini App (client only) ========
  const [mini, setMini] = useState({ ready: false, available: false, sdk: null })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('@farcaster/miniapp-sdk')
        // Some versions expose `sdk.ready()`; all expose an object with actions.
        // We try a no-op call to check availability.
        const s = mod?.sdk || null
        if (s?.actions) {
          // Optional: many SDKs expose ready(); if not, we still proceed.
          try { await s.ready?.() } catch {}
          if (mounted) setMini({ ready: true, available: true, sdk: s })
          return
        }
      } catch {
        // ignore — not inside mini app
      }
      if (mounted) setMini({ ready: true, available: false, sdk: null })
    })()
    return () => { mounted = false }
  }, [])

  // ======== Build the cast text (fun + informative) ========
  const castText = useMemo(() => {
    const parts = []

    // a playful hook
    const hooks = [
      'Fill the blank 👉',
      'Your one word could win 🏆',
      'Quick! This round is live ⚡️',
      'Drop a word, win the pot 💰',
      'Come play a round of MadFill 🎲',
    ]
    parts.push(hooks[Math.floor(Math.random() * hooks.length)])

    if (templateName) parts.push(`“${templateName}”`)
    if (theme) parts.push(`(Theme: ${theme})`)

    // compact facts line
    const facts = []
    if (feeEth) facts.push(`fee ${feeEth} ETH`)
    if (typeof durationMins === 'number' && durationMins > 0) {
      const days = durationMins >= 1440 ? `${Math.round(durationMins / 1440)}d` : `${durationMins}m`
      facts.push(`~${days}`)
    }
    if (facts.length) parts.push(`— ${facts.join(' · ')}`)

    // optional word info
    if (word) {
      const idx = typeof blankIndex === 'number' ? `#${blankIndex + 1}` : '#?'
      parts.push(`I filled blank ${idx} with “${word}”.`)
    }

    // add hashtags at end (Warpcast respects them in text)
    if (hashtags?.length) {
      parts.push(hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' '))
    }

    // Always add the URL on Warpcast/X (lib will also add it if missing)
    parts.push(shareUrl)

    return parts.filter(Boolean).join('  ')
  }, [templateName, theme, feeEth, durationMins, word, blankIndex, hashtags, shareUrl])

  // Normalize embed(s)
  const embeds = useMemo(() => {
    if (!embed) return []
    return Array.isArray(embed) ? embed : [embed]
  }, [embed])

  // ======== Core share handlers ========
  const openWarpcastInMiniApp = useCallback(async () => {
    const href = buildWarpcastCompose({ text: castText, url: shareUrl, embeds })
    // Try the SDK's in-app URL open. Many builds keep users in Warpcast.
    try {
      const s = mini.sdk
      if (mini.available && s?.actions?.openURL) {
        await s.actions.openURL(href)
        return true
      }
      // Some SDK versions expose a direct composer method:
      if (mini.available && s?.actions?.composeCast) {
        await s.actions.composeCast({ text: castText, embeds })
        return true
      }
    } catch {
      // fall through
    }
    return false
  }, [mini, castText, shareUrl, embeds])

  const doShare = useCallback(async () => {
    // 1) Farcaster Mini App → in-app composer (no web bounce)
    if (mini.available) {
      const ok = await openWarpcastInMiniApp()
      if (ok) return
      // If openURL/composeCast failed for any reason, go to fallback chain.
    }

    // 2) Native Web Share if available
    const usedNative = await nativeShare({ title, text: castText, url: shareUrl })
    if (usedNative) return

    // 3) Intent URLs → popup (X or Warpcast web composer)
    const { twitter, warpcast } = buildShareUrls({ url: shareUrl, text: castText, embeds })
    // prefer Warpcast first
    if (warpcast) { await openShareWindow(warpcast); return }
    if (twitter) { await openShareWindow(twitter); return }

    // 4) Clipboard last resort
    const copied = await copyToClipboard(`${castText}`)
    if (copied) {
      console.info('Share text copied to clipboard:', castText)
    } else {
      console.warn('Share failed: no channel available.')
    }
  }, [mini.available, openWarpcastInMiniApp, castText, shareUrl, title, embeds])

  // ======== Optional: show social buttons on web only ========
  const [reactShare, setReactShare] = useState(null)
  useEffect(() => {
    let on = true
    ;(async () => {
      try {
        const mod = await import('react-share')
        if (on) setReactShare(mod)
      } catch {/* ignore */}
    })()
    return () => { on = false }
  }, [])

  const Buttons = useMemo(() => {
    if (!reactShare) return null
    const {
      TwitterShareButton, TelegramShareButton, FacebookShareButton,
      TwitterIcon, TelegramIcon, FacebookIcon,
    } = reactShare
    return { TwitterShareButton, TelegramShareButton, FacebookShareButton, TwitterIcon, TelegramIcon, FacebookIcon }
  }, [reactShare])

  // Build plain URLs for those buttons (works outside mini app)
  const intents = useMemo(() => buildShareUrls({ url: shareUrl, text: castText, embeds }), [shareUrl, castText, embeds])

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={doShare}
        className="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-semibold shadow transition"
        aria-label="Share on Farcaster"
        title="Share on Farcaster"
      >
        ✨ Cast
      </button>

      {Buttons ? (
        <>
          <Buttons.TwitterShareButton url={intents.twitter} title={castText} className="hover:scale-110 transition-transform">
            <Buttons.TwitterIcon size={32} round alt="Share on X" />
          </Buttons.TwitterShareButton>
          <Buttons.FacebookShareButton url={shareUrl} quote={castText} className="hover:scale-110 transition-transform">
            <Buttons.FacebookIcon size={32} round alt="Share on Facebook" />
          </Buttons.FacebookShareButton>
          <Buttons.TelegramShareButton url={shareUrl} title={castText} className="hover:scale-110 transition-transform">
            <Buttons.TelegramIcon size={32} round alt="Share on Telegram" />
          </Buttons.TelegramShareButton>
        </>
      ) : null}

      {/* Copy fallback; handy inside mini app if social buttons are hidden */}
      <button
        onClick={async () => {
          const ok = await copyToClipboard(shareUrl)
          if (ok) console.info('URL copied:', shareUrl)
        }}
        className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white hover:scale-110 transition-all"
        title="Copy link"
        aria-label="Copy link"
      >
        📋
      </button>
    </div>
  )
}
