import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const defaultStickers = ['🐸', '💥', '🌈', '🧠', '🔥', '✨', '🌀', '🎉', '🍕', '👾']
const defaultTheme = 'retro'

const themes = {
  galaxy: 'bg-galaxy',
  tropical: 'bg-tropical',
  retro: 'bg-retro',
  bubblegum: 'bg-bubblegum',
  swamp: 'bg-swamp',
  parchment: 'bg-parchment',
  clouds: 'bg-clouds',
}

export default function MyoPage() {
  const [title, setTitle] = useState('My Epic MadFill')
  const [description, setDescription] = useState('A wild, weird, and fun round I created myself.')
  const [parts, setParts] = useState(['Today I ', '____', ' and then ', '____', ' while riding a ', '____', '!'])
  const [theme, setTheme] = useState(defaultTheme)
  const [stickers, setStickers] = useState(defaultStickers)
  const [activeSticker, setActiveSticker] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('madfill-myo-draft') || '{}')
    if (saved.title) setTitle(saved.title)
    if (saved.description) setDescription(saved.description)
    if (saved.parts) setParts(saved.parts)
    if (saved.theme) setTheme(saved.theme)
  }, [])

  useEffect(() => {
    localStorage.setItem('madfill-myo-draft', JSON.stringify({ title, description, parts, theme }))
  }, [title, description, parts, theme])

  useEffect(() => {
    const closeOnEscape = (e) => {
      if (e.key === 'Escape') setShowPreview(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])

  const handlePartChange = (value, i) => {
    const newParts = [...parts]
    newParts[i] = value
    setParts(newParts)
  }

  const addBlank = () => setParts([...parts, '____'])
  const addTextPart = () => setParts([...parts, ''])

  const toggleSticker = (emoji) => {
    setActiveSticker((prev) => (prev === emoji ? null : emoji))
  }

  const addStickerToEnd = () => {
    if (activeSticker) {
      setParts([...parts, activeSticker])
      setActiveSticker(null)
    }
  }

  const randomizeTheme = () => {
    const keys = Object.keys(themes)
    const next = keys[Math.floor(Math.random() * keys.length)]
    setTheme(next)
  }

  return (
    <Layout>
      <div className={`transition-all duration-1000 ease-in-out min-h-screen p-4 ${themes[theme]}`}>
        <Card className="bg-slate-900 text-white shadow-xl rounded-xl">
          <CardHeader>
            <h2 className="text-xl font-bold">🎨 Make Your Own MadFill</h2>
            <p className="text-sm text-indigo-200">Build your own weird sentence + style and mint it soon!</p>
          </CardHeader>
          <CardContent className="space-y-6">

            <label className="block text-sm font-medium">Title</label>
            <input
              className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <label className="block text-sm font-medium">Description</label>
            <textarea
              className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <label className="block text-sm font-medium">Theme</label>
            <div className="flex gap-2 items-center">
              <select
                className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                {Object.entries(themes).map(([key]) => (
                  <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
                ))}
              </select>
              <Button onClick={randomizeTheme} className="bg-indigo-600 hover:bg-indigo-500">🎲 Randomize</Button>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">🖼️ Stickers (click to select, then "Add to End")</p>
              <div className="flex gap-2 flex-wrap">
                {stickers.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => toggleSticker(s)}
                    className={`text-xl p-2 rounded ${activeSticker === s ? 'bg-indigo-700 scale-110' : 'bg-slate-800 hover:bg-slate-700'}`}
                  >
                    {s}
                  </button>
                ))}
                <button onClick={addStickerToEnd} className="text-sm px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white">+ Add to End</button>
              </div>
            </div>

            <div className="space-y-2">
              {parts.map((part, i) => (
                <input
                  key={i}
                  value={part}
                  onChange={(e) => handlePartChange(e.target.value, i)}
                  className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={addBlank} className="bg-pink-600 hover:bg-pink-500">+ Add Blank</Button>
              <Button onClick={addTextPart} className="bg-slate-700 hover:bg-slate-600">+ Add Text</Button>
              <Button onClick={() => setShowPreview(true)} className="bg-indigo-600 hover:bg-indigo-500">👀 Preview Template</Button>
            </div>

            <div className={`p-6 rounded-xl font-mono text-sm border border-slate-700 bg-opacity-90 ${themes[theme]}`}>
              <p className="text-lg font-bold mb-2">{title}</p>
              <p className="space-x-1">
                {parts.map((p, i) => (
                  <span key={i} className={p === '____' ? 'text-pink-300 underline' : ''}>{p || ' '}</span>
                ))}
              </p>
            </div>

            <div className="text-center mt-6">
              <Button disabled className="bg-slate-600 cursor-not-allowed opacity-60">
                🪙 Mint Template (Coming Soon)
              </Button>
              <p className="text-xs mt-2 text-slate-400 italic">Soon you’ll be able to mint your own MadFill masterpiece!</p>
            </div>
          </CardContent>
        </Card>

        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center px-4">
            <div className={`max-w-md w-full p-6 rounded-xl relative shadow-2xl text-white ${themes[theme]}`}>
              <button onClick={() => setShowPreview(false)} className="absolute top-2 right-3 text-xl text-white">✖️</button>
              <h3 className="text-2xl font-bold mb-2">{title}</h3>
              <p className="text-sm text-slate-200 mb-4 italic">{description}</p>
              <div className="font-mono text-base space-x-1">
                {parts.map((p, i) => (
                  <span key={i} className={p === '____' ? 'text-pink-200 underline' : ''}>{p || ' '}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
