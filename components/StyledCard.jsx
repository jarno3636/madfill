// components/StyledCard.jsx
'use client'

import React, { useMemo } from 'react'

/** Returns true if a space should be inserted before the next string (i.e., it starts with a word char). */
function needsSpaceBefore(str = '') {
  if (!str) return false
  const ch = str[0]
  // No space if next token starts with whitespace or punctuation that typically binds to the previous word
  return !(/\s/.test(ch) || /[.,!?;:)"'\]]/.test(ch))
}

/** Sanitize a single word token: trim, collapse, take first token, clamp length. */
function sanitizeOneWord(s, maxLen = 16) {
  if (typeof s !== 'string') return ''
  const token = s.trim().replace(/\s+/g, ' ').split(' ')[0] || ''
  return token.slice(0, maxLen)
}

/**
 * StyledCard
 * Renders a sentence built from `parts` with up to `blanks` inline word slots.
 *
 * Props:
 * - parts: string[] sentence parts (length >= blanks, typically parts.length = blanks + 1)
 * - blanks: number count of interactive word slots (0..parts.length-1)
 * - words: Record<number, string> mapping blank index -> user word
 * - sanitize: boolean whether to sanitize tokens for display
 * - highlightIndex: number|null index to visually highlight a specific blank
 * - takenIndices: number[] indices considered "locked" (rendered as crossed-out)
 * - className: string extra classes for container
 * - wordClassName: string extra classes for each word badge
 * - maxLen: number maximum token length (default 16)
 */
export default function StyledCard({
  parts = [],
  blanks = 0,
  words = {},
  sanitize = false,
  highlightIndex = null,
  takenIndices = [],
  className = '',
  wordClassName = '',
  maxLen = 16,
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
    const safeBlanks = Math.max(0, Math.min(Number.isFinite(blanks) ? blanks : 0, parts.length))

    for (let i = 0; i < parts.length; i++) {
      const part = (parts[i] ?? '').toString()
      arr.push(
        <span key={`p-${i}`} className="whitespace-pre-wrap">
          {part}
        </span>
      )

      if (i < safeBlanks) {
        // Add the user word (or blank)
        arr.push(renderWord(i))

        // Insert a space if the next part starts with a word character and
        // the rendered word is not empty/locked (i.e., will show a token)
        const nextPart = (parts[i + 1] ?? '').toString()
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
