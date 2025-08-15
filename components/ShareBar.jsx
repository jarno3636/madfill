// components/ShareBar.jsx
'use client'

import { useMemo, useState } from 'react'
import {
  safeUrl,
  buildCastText,
  buildShareUrls,
  copyToClipboard,
  nativeShare,
  shareToWarpcast,
  openShareWindow,
} from '@/lib/share'

/**
 * A fun, mini-app-aware Share Bar.
 * Props you can pass from a round/template page:
 * - url, title, theme, templateName, feeEth, durationMins, word, blankIndex
 * - hashtags: array without '#'
 * - embed: image URL (e.g., OG card), or embeds: []
 */
export default function ShareBar({
  url = '/',
  title = 'MadFill',
  theme = '',
  templateName = '',
  feeEth,
  durationMins,
  word = '',
  blankIndex = 0,
  hashtags = ['MadFill', 'Base', 'Farcaster'],
  embed,      // string
  embeds = [],// string[]
  className = '',
}) {
  // Avoid pulling in lib/seo.absoluteUrl — keep everything client-safe
  const shareUrl = useMemo(() => safeUrl(url), [url])

  const blankLabel = useMemo(
    () => `Blank #${(Number(blankIndex) | 0) + 1}`,
    [blankIndex]
  )

  const allEmbeds = useMemo(() => {
    const arr = []
    if (embed) arr.push(embed)
    if (Array.isArray(embeds) && embeds.length) arr.push(...embeds)
    // Normalize to absolute URLs and drop any bad ones
    return arr.map(e => safeUrl(e)).filter(Boolean)
  }, [embed, embeds])

  const [style, setStyle] = useState('playful') // 'short' | 'playful' | 'serious'

  const castText = useMemo(() => {
    try {
      return buildCastText({
        style, title, theme, templateName, feeEth, durationMins,
        word, blankLabel, url: shareUrl, hashtagList: hashtags,
      })
    } catch {
      // Never crash the page—fallback to something simple
      return `🧠 MadFill — ${title}\nPlay → ${shareUrl}\n#MadFill #Base #Farcaster`
    }
  }, [style, title, theme, templateName, feeEth, durationMins, word, blankLabel, shareUrl, hashtags])

  const shareTargets = useMemo(() => {
    try {
      return buildShareUrls({ url: shareUrl, text: castText, embeds: allEmbeds })
    } catch {
      return { twitter: '', telegram: '' }
    }
  }, [shareUrl, castText, allEmbeds])

  const onCast = async () => {
    try {
      await shareToWarpcast({
        style, url: shareUrl, word, blankLabel, title, theme, templateName,
        feeEth, durationMins, hashtagList: hashtags, embeds: allEmbeds,
      })
    } catch (e) {
      // As a last resort, copy the text so users can paste in-app
      await copyToClipboard(`${castText}`)
    }
  }

  const onShareX = async () => {
    if (!shareTargets.twitter) return
    await openShareWindow(shareTargets.twitter)
  }

  const onShareTelegram = async () => {
    if (!shareTargets.telegram) return
    await openShareWindow(shareTargets.telegram)
  }

  const onSystemShare = async () => {
    const ok = await nativeShare({ title, text: castText, url: shareUrl })
    if (!ok) await copyToClipboard(shareUrl)
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Preview bubble */}
      <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-3 text-sm">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-slate-300">Cast preview</div>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="rounded-lg bg-slate-800 border border-slate-600 px-2 py-1 text-xs"
            aria-label="Cast style"
          >
            <option value="short">Short</option>
            <option value="playful">Playful</option>
            <option value="serious">Serious</option>
          </select>
        </div>
        <pre className="whitespace-pre-wrap text-slate-100 text-sm leading-relaxed font-sans">
{castText}
        </pre>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onCast}
          className="px-4 h-10 rounded-xl bg-[#7C5CFC] hover:opacity-90 text-white font-semibold tracking-wide"
          title="Cast on Farcaster"
        >
          ✨ Cast this
        </button>

        <button
          onClick={onShareX}
          className="px-3 h-10 rounded-xl bg-black hover:bg-black/80 text-white"
          title="Share on X"
          aria-label="Share on X"
        >
          𝕏
        </button>

        <button
          onClick={onShareTelegram}
          className="px-3 h-10 rounded-xl bg-[#229ED9] hover:opacity-90 text-white"
          title="Share on Telegram"
          aria-label="Share on Telegram"
        >
          Telegram
        </button>

        <button
          onClick={onSystemShare}
          className="px-3 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
          title="Share or copy"
          aria-label="Share or copy"
        >
          📋 Copy / Share
        </button>
      </div>
    </div>
  )
}
