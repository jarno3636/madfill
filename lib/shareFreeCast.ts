export function shareFreeCast({ sentence, word }: { sentence: string; word: string }) {
  const castText = `😄 I played a round of Free MadFill!\n\n"${sentence}"\n\nI filled in: ${word}\n\nPlay your own here 👉 https://madfill.vercel.app/free #MadFill #OnChainGames`

  const shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`
  window.open(shareUrl, '_blank')
}
