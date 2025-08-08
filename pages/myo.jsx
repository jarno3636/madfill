// pages/myo.jsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import StyledCard from '@/components/StyledCard'
import clsx from 'clsx'

const defaultStickers = ['🐸', '💥', '🌈', '🧠', '🔥', '✨', '🌀', '🎉', '🍕', '👾']
const defaultTheme = 'retro'

// Visual themes just for previewing off-chain creations
const themes = {
  galaxy: {
    label: 'Galaxy',
    bg: 'bg-gradient-to-br from-indigo-900 to-purple-900',
    text: 'text-white',
  },
  tropical: {
    label: 'Tropical',
    bg: 'bg-gradient-to-br from-green-400 to-yellow-500',
    text: 'text-slate-900',
  },
  retro: {
    label: 'Retro',
    bg: 'bg-gradient-to-br from-pink-500 to-orange-400',
    text: 'text-slate-900',
  },
  parchment: {
    label: 'Parchment',
    bg: 'bg-[url("/parchment-texture.PNG")] bg-cover bg-center',
    text: 'text-slate-900',
  },
  clouds: {
    label: 'Clouds',
    bg: 'bg-[url("/clouds-texture.PNG")] bg-cover bg-center',
    text: 'text-slate-800',
  },
}

const BLANK = '____'
const DRAFT_KEY = 'madfill-myo-draft-v2'

export default function MyoPage() {
  const [title, setTitle] = useState('My Epic MadFill')
  const [description, setDescription] = useState('A wild, weird, and fun round I created myself.')
  const [parts, setParts] = useState(['Today I ', BLANK, ' and then ', BLANK, ' while riding a ', BLANK, '!'])
  const [theme, setTheme] = useState(defaultTheme)
  const [stickers, setStickers] = useState(defaultStickers)
  const [activeSticker, setActiveSticker] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const [importError, setImportError] = useState('')
  const fileRef = useRef(null)

  // Restore draft
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')
      if (saved.title) setTitle(saved.title)
      if (saved.description) setDescription(saved.description)
      if (Array.isArray(saved.parts) && saved.parts.length) setParts(saved.parts)
      if (saved.theme && themes[saved.theme]) setTheme(saved.theme)
    } catch {
      // ignore
    }
  }, [])

  // Autosave
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, parts, theme }))
  }, [title, description, parts, theme])

  // Derived template info for a “card mode” preview
  const asCard = useMemo(() => {
    // Convert your ["text", "____", "text", "____", ...] to StyledCard format: {partsOut, blanks, words}
    const partsOut = []
    let blanks = 0
    for (let i = 0; i < parts.length; i++) {
      const token = parts[i] ?? ''
      if (token === BLANK) {
        blanks++
        // Do not push anything for the blank here; blanks are inserted between partsOut items
        // Ensure there is a next text part placeholder if missing
        if (!partsOut.length) partsOut.push('')
      } else {
        partsOut.push(token)
      }
    }
    // Ensure partsOut has at least blanks+1 slots
    while (partsOut.length < blanks + 1) partsOut.push('')
    return { partsOut, blanks }
  }, [parts])

  const counts = useMemo(() => {
    const blanks = parts.filter(p => p === BLANK).length
    const textParts = parts.length - blanks
    return { blanks, textParts, total: parts.length }
  }, [parts])

  const isValidTemplate = useMemo(() => {
    // A valid fill-in template must have at least 1 blank and at least 2 total parts
    // Also for StyledCard correctness, need partsOut.length === blanks + 1
    if (counts.blanks < 1) return false
    if (asCard.partsOut.length !== counts.blanks + 1) return false
    return true
  }, [counts, asCard])

  // Part list helpers
  const handlePartChange = (value, i) => {
    const next = [...parts]
    next[i] = value
    setParts(next)
  }

  const addBlank = (i = parts.length) => {
    const next = [...parts]
    next.splice(i, 0, BLANK)
    setParts(next)
  }
  const addTextPart = (i = parts.length) => {
    const next = [...parts]
    next.splice(i, 0, '')
    setParts(next)
  }
  const removePart = (i) => {
    const next = parts.filter((_, idx) => idx !== i)
    setParts(next.length ? next : [''])
  }
  const movePart = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= parts.length) return
    const next = [...parts]
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    setParts(next)
  }

  const toggleSticker = (emoji) => {
    setActiveSticker(prev => (prev === emoji ? null : emoji))
  }
  const addStickerToEnd = () => {
    if (activeSticker) {
      setParts(p => [...p, activeSticker])
      setActiveSticker(null)
    }
  }
  const randomizeTheme = () => {
    const keys = Object.keys(themes)
    const pick = keys[Math.floor(Math.random() * keys.length)]
    setTheme(pick)
  }

  // Share & copy helpers
  const rawText = useMemo(() => parts.join(' '), [parts])
  const shareText = useMemo(() => {
    return encodeURIComponent(
      `🧠 I made a custom MadFill!\n\n${rawText}\n\nTry it here: https://madfill.vercel.app/myo`
    )
  }, [rawText])

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(rawText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  // Export/import JSON (future-mint friendly)
  const exportJSON = () => {
    const payload = {
      version: 1,
      title,
      description,
      theme,
      parts,
      createdAt: Date.now(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '-').slice(0, 32) || 'my-madfill'}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const importJSON = async (file) => {
    setImportError('')
    try {
      const text = await file.text()
      const obj = JSON.parse(text)
      if (!Array.isArray(obj?.parts) || obj.parts.length < 2) throw new Error('Invalid template file')
      setTitle(String(obj.title || 'Untitled'))
      setDescription(String(obj.description || ''))
      setParts(obj.parts.map(x => (typeof x === 'string' ? x : String(x))))
      if (obj.theme && themes[obj.theme]) setTheme(obj.theme)
    } catch (e) {
      setImportError('Invalid or corrupted file.')
    }
  }

  return (
    <Layout>
      {/* Header */}
      <div className="rounded-xl shadow-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 card">
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold tracking-tight">🎨 Make Your Own MadFill</h2>
          <p className="text-sm text-indigo-300">
            Build your own weird sentence + style. Minting coming soon!
          </p>
        </div>

        {/* Title / Description */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 48))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                {Object.entries(themes).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <Button onClick={randomizeTheme} className="bg-purple-600 hover:bg-purple-500">🎲 Random</Button>
            </div>
          </div>
        </div>

        <label className="block text-sm font-medium mt-4 mb-1">Short Description</label>
        <textarea
          rows={2}
          className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 200))}
        />

        {/* Stickers */}
        <div className="mt-4">
          <p className="text-sm font-medium mb-1">🖼️ Stickers (click to select, then "Add to End")</p>
          <div className="flex gap-2 flex-wrap">
            {stickers.map((s, i) => (
              <button
                key={i}
                onClick={() => toggleSticker(s)}
                className={`text-xl p-2 rounded transition-transform ${activeSticker === s ? 'bg-indigo-700 scale-110' : 'bg-slate-800 hover:bg-slate-700'}`}
                title="Select sticker"
              >
                {s}
              </button>
            ))}
            <Button onClick={addStickerToEnd} className="bg-indigo-600 hover:bg-indigo-500">+ Add to End</Button>
          </div>
        </div>

        {/* Parts editor */}
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-300">
              Parts: {counts.total} • Text: {counts.textParts} • Blanks: {counts.blanks}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addTextPart(parts.length)} className="bg-slate-700 hover:bg-slate-600">+ Add Text</Button>
              <Button onClick={() => addBlank(parts.length)} className="bg-pink-600 hover:bg-pink-500">+ Add Blank</Button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {parts.map((part, i) => {
              const isBlank = part === BLANK
              return (
                <div key={i} className="flex items-center gap-2">
                  {isBlank ? (
                    <div className="flex-1">
                      <div className="w-full bg-slate-800 text-pink-300 border border-pink-500/40 rounded px-3 py-2 text-sm text-center">
                        {BLANK}
                      </div>
                    </div>
                  ) : (
                    <input
                      value={part}
                      onChange={(e) => handlePartChange(e.target.value, i)}
                      className="flex-1 bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
                      placeholder="Text part..."
                    />
                  )}

                  {/* Row controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => movePart(i, -1)}
                      className="px-2 py-2 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => movePart(i, +1)}
                      className="px-2 py-2 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => addTextPart(i + 1)}
                      className="px-2 py-2 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
                      title="Insert text"
                    >
                      T+
                    </button>
                    <button
                      onClick={() => addBlank(i + 1)}
                      className="px-2 py-2 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
                      title="Insert blank"
                    >
                      _+
                    </button>
                    <button
                      onClick={() => removePart(i)}
                      className="px-2 py-2 rounded bg-red-700 border border-red-600 hover:bg-red-600"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Validation tips */}
          <div className="mt-3 text-xs">
            {isValidTemplate ? (
              <span className="text-emerald-300">Looks good! Each blank will be filled between the surrounding text parts.</span>
            ) : (
              <span className="text-amber-300">
                Tip: Use at least one "{BLANK}" and make sure there are text parts on both sides of your blanks.
              </span>
            )}
          </div>
        </div>

        {/* Live Preview (theme frame) */}
        <div className={clsx('mt-6 p-6 rounded-xl border border-slate-700', themes[theme].bg, themes[theme].text)}>
          <p className="text-lg font-bold mb-2">{title}</p>
          <p className="text-xs opacity-80 mb-3">{description}</p>

          {/* Text-mode preview */}
          <p className="space-x-1 leading-relaxed">
            {parts.map((p, i) => (
              <span key={i} className={p === BLANK ? 'text-pink-300 underline' : ''}>{p || ' '}</span>
            ))}
          </p>

          {/* Card-mode preview */}
          <div className="mt-4">
            <StyledCard
              parts={asCard.partsOut}
              blanks={asCard.blanks}
              words={{}}
              sanitize
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button disabled className="bg-gray-700 cursor-not-allowed">⛓️ Mint Coming Soon</Button>
          <a
            href={`https://warpcast.com/~/compose?text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white"
          >
            🌀 Share
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            🐦 Tweet
          </a>
          <button
            onClick={copyTemplate}
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
          >
            {copied ? '✅ Copied' : '📋 Copy Text'}
          </button>

          <button
            onClick={exportJSON}
            className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white"
          >
            ⬇️ Export JSON
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white"
          >
            ⬆️ Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importJSON(file)
              e.target.value = ''
            }}
          />
          {importError && <span className="text-xs text-red-300">{importError}</span>}
        </div>

        {/* Full-screen modal preview */}
        {showPreview && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
            <div className={clsx('max-w-md w-full p-6 rounded-xl relative shadow-2xl', themes[theme].bg, themes[theme].text)}>
              <button
                onClick={() => setShowPreview(false)}
                className="absolute top-2 right-3 text-xl"
                aria-label="Close"
              >
                ✖️
              </button>
              <h3 className="text-2xl font-bold mb-2">{title}</h3>
              <p className="text-sm opacity-80 mb-4 italic">{description}</p>
              <div className="font-mono text-base space-x-1">
                {parts.map((p, i) => (
                  <span key={i} className={p === BLANK ? 'text-pink-200 underline' : ''}>{p || ' '}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
