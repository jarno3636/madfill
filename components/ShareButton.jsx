// components/ShareButton.jsx
'use client'
import { shareFreeCast } from '@/lib/shareFreeCast'

export default function ShareButton({
  sentence,
  word,
  variant = 'farcaster',
  url = 'https://madfill.vercel.app', // default site
  labelOverride,
}) {
  const handleClick = async () => {
    try {
      const text = `${sentence}\n${url || ''}`

      if (variant === 'farcaster') {
        shareFreeCast({ sentence, word })
      } else if (variant === 'twitter') {
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
          '_blank'
        )
      } else if (variant === 'copy') {
        await navigator.clipboard.writeText(text)
        alert('Link copied to clipboard ✅')
      }
    } catch (err) {
      console.warn(`ShareButton ${variant} failed:`, err)
      alert('Sharing failed. Please try again.')
    }
  }

  const label =
    labelOverride ||
    {
      farcaster: '🌀 Share on Farcaster',
      twitter: '🐦 Share on Twitter',
      copy: '📋 Copy Link',
    }[variant] ||
    'Share'

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center justify-center gap-2 px-4 py-2 mt-4
        bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
        text-white font-semibold rounded-full shadow-lg
        transition-all duration-200 hover:shadow-xl active:scale-95
        text-sm sm:text-base"
      aria-label={label}
    >
      {label}
    </button>
  )
}
