import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import clsx from 'clsx'

const defaultStickers = ['🐸', '💥', '🌈', '🧠', '🔥', '✨', '🌀', '🎉', '🍕', '👾']
const defaultTheme = 'retro'

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
    const pick = keys[Math.floor(Math.random() * keys.length)]
    setTheme(pick)
  }

  return (
    <Layout>
      <div className={`transition-all duration-700 p-4 rounded-xl shadow-xl ${themes[theme].bg}`}>
        <Card className={`bg-black bg-opacity-60 backdrop-blur-md p-4 md:p-6 rounded-xl border border-slate-700`}>
          <CardHeader>
            <h2 className="text-xl font-bold text-white">🎨 Make Your Own MadFill</h2>
            <p className="text-sm text-indigo-200">Build your own weird sentence + style and mint it soon!</p>
          </CardHeader>
          <CardContent className="space-y-6 text-white">

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

            <div className="flex gap-2 items-center">
              <label className="block text-sm font-medium">Theme</label>
              <select
                className="bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 ml-2"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                {Object.entries(themes).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <Button onClick={randomizeTheme} className="bg-purple-600 hover:bg-purple-500 ml-auto">
                🎲 Randomize
              </Button>
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

            <div className={`p-6 rounded-xl font-mono text-sm border border-slate-700 ${themes[theme].bg} ${themes[theme].text}`}>
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
            <div className={`max-w-md w-full p-6 rounded-xl relative shadow-2xl ${themes[theme].bg} ${themes[theme].text}`}>
              <button onClick={() => setShowPreview(false)} className="absolute top-2 right-3 text-xl">✖️</button>
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
