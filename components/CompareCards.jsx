'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ethers } from 'ethers'
import ShareBar from '@/components/ShareBar'

// --- helpers ---
function tryDecode(word) {
  if (typeof word !== 'string') return ''
  if (/^0x[0-9a-fA-F]+$/.test(word) && word.length === 66) {
    try { return ethers.decodeBytes32String(word) } catch {}
  }
  return word
}

function normalizeWords(input) {
  if (!input) return { mode: 'single', index: 0, words: [] }
  if (Array.isArray(input)) {
    return { mode: 'array', index: 0, words: input.map((w) => tryDecode(String(w))) }
  }
  const s = String(input).trim()
  const sep = s.indexOf('::')
  if (sep > -1) {
    const idx = Math.max(0, Number.parseInt(s.slice(0, sep), 10) || 0)
    const w = tryDecode(s.slice(sep + 2))
    return { mode: 'singleIndex', index: idx, words: [w] }
  }
  if (s.includes(',')) {
    const arr = s.split(',').map((x) => tryDecode(x.trim())).filter(Boolean)
    return { mode: 'array', index: 0, words: arr }
  }
  return { mode: 'single', index: 0, words: [tryDecode(s)] }
}

function needsSpaceBefore(str) {
  if (!str) return false
  const ch = str[0]
  return !(/\s/.test(ch) || /[.,!?;:)"'\]]/.test(ch))
}

function buildPreview(parts, norm) {
  const n = parts?.length || 0
  if (n === 0) return ''
  const out = []
  for (let i = 0; i < n; i++) {
    out.push(parts[i] || '')
    if (i < n - 1) {
      let fill = '____'
      if (norm.mode === 'array') fill = norm.words[i] || '____'
      else if (norm.mode === 'singleIndex') fill = i === norm.index ? (norm.words[0] || '____') : '____'
      else fill = i === 0 ? (norm.words[0] || '____') : '____'
      out.push(fill)
      if (fill !== '____' && needsSpaceBefore(parts[i + 1] || '')) out.push(' ')
    }
  }
  return out.join('')
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

// --- component ---
export default function CompareCards({
  originalWord,
  challengerWord,
  originalWords = [],
  challengerWords = [],
  parts = null,
  tpl = null,
  winner = null,
  originalAvatar = null,
  challengerAvatar = null,
  originalUsername = null,
  challengerUsername = null,
  originalVotes = 0,
  challengerVotes = 0,
  roundId = null
}) {
  const templateParts = parts || tpl?.parts || []

  const normOriginal = useMemo(() => {
    if (originalWord != null) return normalizeWords(originalWord)
    return normalizeWords(originalWords)
  }, [originalWord, originalWords])

  const normChallenger = useMemo(() => {
    if (challengerWord != null) return normalizeWords(challengerWord)
    return normalizeWords(challengerWords)
  }, [challengerWord, challengerWords])

  const originalPreview = useMemo(() => buildPreview(templateParts, normOriginal), [templateParts, normOriginal])
  const challengerPreview = useMemo(() => buildPreview(templateParts, normChallenger), [templateParts, normChallenger])

  const total = clamp(Number(originalVotes) + Number(challengerVotes), 0, 1e9)
  const pctO = total ? Math.round((Number(originalVotes) / total) * 100) : 0
  const pctC = total ? 100 - pctO : 0

  const isOriginalWinner = winner === 'original'
  const isChallengerWinner = winner === 'challenger'

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://madfill.vercel.app'
  const roundUrl = roundId ? `${baseUrl}/round/${roundId}` : baseUrl

  function CardSide({ label, preview, isWinnerSide, avatar, username }) {
    return (
      <div className="flex flex-col items-center p-4 bg-slate-900/80 rounded-xl border border-slate-700 shadow-lg">
        <p className="text-sm font-semibold">{label}</p>
        {avatar && <img src={avatar} alt={`${label} avatar`} className="w-9 h-9 rounded-full border border-white my-2" />}
        {username && <p className="text-xs text-slate-400">@{username}</p>}
        <div className="text-sm md:text-base italic leading-relaxed text-center whitespace-pre-wrap mt-2">{preview}</div>
        {isWinnerSide && (
          <div className="mt-2 text-yellow-300 text-xs font-bold flex items-center gap-1">
            🏆 Winner
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-6">
        <CardSide
          label="Original Card"
          preview={originalPreview}
          isWinnerSide={isOriginalWinner}
          avatar={originalAvatar}
          username={originalUsername}
        />
        <CardSide
          label="Challenger Card"
          preview={challengerPreview}
          isWinnerSide={isChallengerWinner}
          avatar={challengerAvatar}
          username={challengerUsername}
        />
      </div>

      {/* Combined animated progress bar */}
      <div className="relative h-7 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
        {/* Left (Original) grows from 0 → pctO */}
        <motion.div
          className="absolute left-0 top-0 h-full bg-green-500"
          initial={{ width: '0%' }}
          animate={{ width: `${pctO}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
        />
        {/* Right (Challenger) grows from 0 → pctC */}
        <motion.div
          className="absolute right-0 top-0 h-full bg-blue-500"
          initial={{ width: '0%' }}
          animate={{ width: `${pctC}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, delay: 0.05 }}
        />
        {/* Labels fade/slide in */}
        <motion.div
          className="absolute inset-0 flex justify-between items-center text-xs font-bold text-white px-2"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <span>{pctO}% ({originalVotes} votes)</span>
          <span>{pctC}% ({challengerVotes} votes)</span>
        </motion.div>
      </div>

      {/* Share bar */}
      <div className="flex justify-center">
        <ShareBar url={roundUrl} text={`Vote on this MadFill Round #${roundId || ''}`} embedUrl={roundUrl} />
      </div>
    </div>
  )
}
