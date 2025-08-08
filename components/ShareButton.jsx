// components/ShareButton.jsx
import { shareFreeCast } from '../lib/shareFreeCast'

export default function ShareButton({ sentence, word, variant = 'farcaster', url }) {
  const handleClick = () => {
    if (variant === 'farcaster') {
      shareFreeCast({ sentence, word })
    } else if (variant === 'twitter') {
      const shareText = encodeURIComponent(`${sentence}\n${url || ''}`)
      window.open(`https://twitter.com/intent/tweet?text=${shareText}`, '_blank')
    } else if (variant === 'copy') {
      navigator.clipboard.writeText(`${sentence}\n${url || ''}`)
    }
  }

  const label = {
    farcaster: '🌀 Share on Farcaster',
    twitter: '🐦 Share on Twitter',
    copy: '📋 Copy Link',
  }[variant]

  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-center gap-2 mt-4 px-4 py-2 
        bg-indigo-600 hover:bg-indigo-500 
        text-white font-semibold rounded-full 
        shadow-lg transition-all duration-200 hover:shadow-xl 
        text-sm sm:text-base active:scale-95"
      aria-label={label}
    >
      {label}
    </button>
  )
}
