// components/StyledCard.jsx
'use client'

import React, { useMemo } from 'react'

function needsSpaceBefore(str = '') {
  if (!str) return false
  const ch = str[0]
  return !(/\s/.test(ch) || /[.,!?;:)"'\]]/.test(ch))
}

function sanitizeOneWord(s, maxLen = 16) {
  if (typeof s !== 'string') return ''
  // collapse whitespace, keep first token only, clamp length
  const token = s.trim().replace(/\s+/g, ' ').split(' ')[0] || ''
  return token.slice(0, maxLen)
}

export default function StyledCard({
  parts = [],
  blanks = 0,
  words = {},                 // { [i]: string }
  sanitize = false,           // sanitize word tokens
  highlightIndex = null,      // number | null
  takenIndices = [],          // number[] of already-used blanks
  className = '',
  wordClassName = '',
  maxLen = 16,                // NEW: keep consistent with other pages (was 32 here)
}) {
  const takenSet = useMemo(() => new Set(takenIndices || []), [takenIndices])

  const renderWord = (i) => {
    let w = words?.[i]
    if (sanitize) w = sanitizeOneWord(w, maxLen)
    const isLocked = takenSet.has(i)
    const isHighlight = highlightIndex === i

    const base =
      'inline-block font-bold mx-1 px-1.5 py-0.5 rounded transition-colors duration-150'
    const color = isLocked
      ? 'bg-slate-700 text-slate-300 line-through opacity-70'
      : 'text-pink-300 bg-slate-800 border border-pink-500/30'
    const glow = isHighlight ? 'ring-2 ring-pink-400/60 shadow-pink-500/20 shadow' : ''

    return (
      <span key={`w-${i}`} className={`${base} ${color} ${glow} ${wordClassName}`}>
        {w && !isLocked ? w : '____'}
      </span>
    )
  }

  const nodes = useMemo(() => {
    const arr = []
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] || ''
      arr.push(
        <span key={`p-${i}`} className="whitespace-pre-wrap">
          {part}
        </span>
      )

      if (i < blanks) {
        // Add the user word (or blank)
        arr.push(renderWord(i))

        // Insert a space if the next part starts with a letter/number
        const nextPart = parts[i + 1] || ''
        const rawWord = words?.[i]
        const showWord = takenSet.has(i) ? '' : (sanitize ? sanitizeOneWord(rawWord, maxLen) : rawWord)
        if (showWord && needsSpaceBefore(nextPart)) {
          arr.push(
            <span key={`sp-${i}`} className="inline-block">
              {' '}
            </span>
          )
        }
      }
    }
    return arr
  }, [parts, blanks, words, sanitize, takenSet, maxLen, wordClassName, highlightIndex])

  return (
    <div
      className={`bg-gradient-to-br from-slate-900 to-slate-800 border border-indigo-700 rounded-xl p-4 shadow-inner text-lg font-medium leading-relaxed ${className}`}
    >
      {nodes}
    </div>
  )
}
