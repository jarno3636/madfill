// components/CompareCards.jsx
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
  challengerUsername = null
}) {
  const renderCard = (words, label, color, isWinner, avatar, username) => {
    if (!tpl || !tpl.parts) return null

    return (
      <div className={`relative border p-4 rounded bg-slate-800 text-white shadow-md ${color} ${isWinner ? 'ring-4 ring-yellow-400' : ''}`}>
        <p className="text-sm mb-2 font-semibold text-center">{label}</p>

        {avatar && (
          <div className="flex justify-center mb-2">
            <img src={avatar} alt={`${label} avatar`} className="w-8 h-8 rounded-full border border-white" />
          </div>
        )}
        {username && (
          <p className="text-xs text-center text-slate-400 mb-2">@{username}</p>
        )}

        <div className="font-mono text-sm leading-relaxed text-center text-lg">
          {tpl.parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < words.length && (
                <motion.span
                  className="text-yellow-300 font-bold"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  {ethers.decodeBytes32String(words[i])}
                </motion.span>
              )}
            </span>
          ))}
        </div>

        {isWinner && (
          <div className="absolute top-1 right-2 text-yellow-400 text-xs font-bold animate-bounce">🏆 Winner</div>
        )}
      </div>
    )
  }

  const isOriginalWinner = winner === 'original'
  const isChallengerWinner = winner === 'challenger'

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {renderCard(
        originalWords,
        'Original Card',
        'border-green-600',
        isOriginalWinner,
        originalAvatar,
        originalUsername
      )}
      {renderCard(
        challengerWords,
        'Challenger Card',
        'border-blue-600',
        isChallengerWinner,
        challengerAvatar,
        challengerUsername
      )}
    </div>
  )
}
