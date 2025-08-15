// components/ShareBar.jsx
'use client'

import { useMemo } from 'react'
import {
  absoluteUrl,
  openFarcasterCompose,
  openXIntent,
  tryNativeShareOrCopy,
} from '@/lib/share'

export default function ShareBar({
  url,
  text = 'Fill the blank with me on MadFill!',
  embeds = [],          // e.g. OG image or pool image(s)
  className = '',
}) {
  const shareUrl = useMemo(() => absoluteUrl(url || '/'), [url])
  const castText = useMemo(() => {
    // short, catchy default
    return text || 'Fill the blank with me on MadFill!'
  }, [text])

  const onCast = async () => {
    await openFarcasterCompose({ text: castText, url: shareUrl, embeds })
  }

  const onX = () => {
    openXIntent({ text: castText, url: shareUrl })
  }

  const onShareCopy = async () => {
    const ok = await tryNativeShareOrCopy({ title: 'MadFill', text: castText, url: shareUrl })
    if (!ok) {
      // optional: toast UI
      console.info('Link copied (or attempted)!')
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-purple-200 mr-2">Share:</span>

      {/* Cast (Farcaster) */}
      <button
        onClick={onCast}
        className="px-3 h-8 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium hover:scale-[1.02] transition-all"
        title="Cast on Farcaster"
        aria-label="Cast on Farcaster"
      >
        Cast
      </button>

      {/* X / Twitter */}
      <button
        onClick={onX}
        className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-white text-base flex items-center justify-center hover:scale-110 transition-all"
        title="Share on X"
        aria-label="Share on X"
      >
        𝕏
      </button>

      {/* Native Share / Copy */}
      <button
        onClick={onShareCopy}
        className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center hover:scale-110 transition-all"
        title="Share or Copy link"
        aria-label="Share or copy link"
      >
        📋
      </button>
    </div>
  )
}
