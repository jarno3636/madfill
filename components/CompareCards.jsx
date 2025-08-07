import React from 'react'
import { ethers } from 'ethers'
import { motion } from 'framer-motion'

export default function CompareCards({
  originalWords = [],
  challengerWords = [],
  tpl,
  winner = null,
  originalAvatar = null,
  challengerAvatar = null,
  originalUsername = null,
  challengerUsername = null,
  originalVotes = 0,
  challengerVotes = 0,
  roundId = null
}) {
  const decodeWord = (word) => {
    try {
      return ethers.decodeBytes32String(word)
    } catch {
      return ''
    }
  }

  const totalVotes = originalVotes + challengerVotes
  const percentOriginal = totalVotes ? Math.round((originalVotes / totalVotes) * 100) : 0
  const percentChallenger = 100 - percentOriginal

  const renderCard = (words, label, color, isWinner, avatar, username, votes, percent, entryType) => {
    if (!tpl || !tpl.parts) return null

    const baseLink = `https://madfill.vercel.app/round/${roundId}`
    const shareText = encodeURIComponent(`Check out my ${label.toLowerCase()} card on MadFill Round #${roundId}! 🧠\n${baseLink}`)

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`relative border p-4 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-lg ${color} ${
          isWinner ? 'ring-4 ring-yellow-400' : 'hover:ring-2 hover:ring-slate-600'
        }`}
      >
        <div className="flex flex-col items-center mb-2">
          <p className="text-sm font-semibold">{label}</p>
          {avatar && (
            <img src={avatar} alt={`${label} avatar`} className="w-9 h-9 rounded-full border border-white my-2" />
          )}
          {username && (
            <p className="text-xs text-slate-400">@{username}</p>
          )}
        </div>

        <div className="font-mono text-base leading-relaxed text-center space-y-1">
          {tpl.parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < words.length && (
                <motion.span
                  className="text-yellow-300 font-bold"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  {decodeWord(words[i])}
                </motion.span>
              )}
            </span>
          ))}
        </div>

        {isWinner && (
          <div className="absolute top-1 right-2 text-yellow-400 text-xs font-bold animate-bounce">
            🏆 Winner
          </div>
        )}

        <div className="absolute top-1 left-2 bg-slate-700 text-white text-xs px-2 py-0.5 rounded">
          🗳️ {votes} vote{votes !== 1 ? 's' : ''}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
            <div
              className={`h-full ${entryType === 'original' ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${percent}%` }}
            ></div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-1">{percent}% of votes</p>
        </div>

        {/* Share buttons */}
        <div className="flex justify-center gap-3 mt-4 text-sm">
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="underline text-blue-400"
          >
            🐦 Twitter
          </a>
          <a
            href={`https://warpcast.com/~/compose?text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="underline text-purple-400"
          >
            🌀 Warpcast
          </a>
        </div>
      </motion.div>
    )
  }

  const isOriginalWinner = winner === 'original'
  const isChallengerWinner = winner === 'challenger'

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {renderCard(
        originalWords,
        'Original Card',
        'border-green-600',
        isOriginalWinner,
        originalAvatar,
        originalUsername,
        originalVotes,
        percentOriginal,
        'original'
      )}
      {renderCard(
        challengerWords,
        'Challenger Card',
        'border-blue-600',
        isChallengerWinner,
        challengerAvatar,
        challengerUsername,
        challengerVotes,
        percentChallenger,
        'challenger'
      )}
    </div>
  )
}
