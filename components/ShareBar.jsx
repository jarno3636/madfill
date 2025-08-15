'use client'

import { useMemo, useState } from 'react'
import {
  buildCastText,
  buildShareUrls,
  copyToClipboard,
  nativeShare,
  shareToWarpcast,
  openShareWindow,
} from '@/lib/share'
import { absoluteUrl } from '@/lib/seo'

/**
 * A fun, mini-app-aware Share Bar.
 * Props you can pass from a round/template page:
 * - url, title, theme, templateName, feeEth, durationMins, word, blankIndex
 * - hashtags: array without '#'
 * - embed: image URL (e.g., OG card), or embeds: []
 */
export default function ShareBar({
  url,
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
  const shareUrl = absoluteUrl(url || '/')
  const blankLabel = `Blank #${(Number(blankIndex) | 0) + 1}`
  const allEmbeds = useMemo(() => {
    const arr = []
    if (embed) arr.push(embed)
    if (Array.isArray(embeds) && embeds.length) arr.push(...embeds)
    return arr
  }, [embed, embeds])

  const [style, setStyle] = useState('playful') // 'short' | 'playful' | 'serious'
  const castText = useMemo(
    () =>
      buildCastText({
        style, title, theme, templateName, feeEth, durationMins,
        word, blankLabel, url: shareUrl, hashtagList: hashtags,
      }),
    [style, title, theme, templateName, feeEth, durationMins, word, blankLabel, shareUrl, hashtags]
  )

  const { twitter, telegram } = useMemo(
    () => buildShareUrls({ url: shareUrl, text: castText, embeds: allEmbeds }),
    [shareUrl, castText, allEmbeds]
  )

  const onCast = async () => {
    await shareToWarpcast({
      style, url: shareUrl, word, blankLabel, title, theme, templateName,
      feeEth, durationMins, hashtagList: hashtags, embeds: allEmbeds,
    })
  }

  const onShareX = async () => openShareWindow(twitter)
  const onShareTelegram = async () => openShareWindow(telegram)
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
