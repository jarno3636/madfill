import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

const defaultStickers = ['🐸', '💥', '🌈', '🧠', '🔥', '✨', '🌀', '🎉', '🍕', '👾']
const defaultTheme = 'retro'

const themes = {
  galaxy: 'from-indigo-900 to-purple-900',
  tropical: 'from-green-400 to-yellow-500',
  retro: 'from-pink-500 to-orange-400',
  bubblegum: 'from-pink-300 to-purple-300',
  swamp: 'from-green-700 to-emerald-800',
}

export default function MyoPage() {
  const [title, setTitle] = useState('My Epic MadFill')
  const [description, setDescription] = useState('A wild, weird, and fun round I created myself.')
  const [parts, setParts] = useState(['Today I ', '____', ' and then ', '____', ' while riding a ', '____', '!'])
  const [theme, setTheme] = useState(defaultTheme)
  const [stickers, setStickers] = useState(defaultStickers)
  const [activeSticker, setActiveSticker] = useState(null)

  useEffect(() => {
    // Load saved draft
    const saved = JSON.parse(localStorage.getItem('madfill-myo-draft') || '{}')
    if (saved.title) setTitle(saved.title)
    if (saved.description) setDescription(saved.description)
    if (saved.parts) setParts(saved.parts)
    if (saved.theme) setTheme(saved.theme)
  }, [])

  useEffect(() => {
    // Save draft
    localStorage.setItem('madfill-myo-draft', JSON.stringify({ title, description, parts, theme }))
  }, [title, description, parts, theme])

  const handlePartChange = (value, i) => {
    const newParts = [...parts]
    newParts[i] = value
    setParts(newParts)
  }

  const addBlank = () => {
    setParts([...parts, '____'])
  }

  const addTextPart = () => {
    setParts([...parts, ''])
  }

  const toggleSticker = (emoji) => {
    setActiveSticker((prev) => (prev === emoji ? null : emoji))
  }

  const addStickerToEnd = () => {
    if (activeSticker) {
      setParts([...parts, activeSticker])
      setActiveSticker(null)
    }
  }

  return (
    <Layout>
      <Card className="bg-gradient-to-br from-slate-900 to-purple-900 text-white shadow-xl rounded-xl">
        <CardHeader>
          <h2 className="text-xl font-bold">🎨 Make Your Own MadFill</h2>
          <p className="text-sm text-indigo-200">Build your own weird sentence + style and mint it soon!</p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Title */}
          <input
            className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Template Title"
          />

          {/* Description */}
          <textarea
            className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your hilarious round"
          />

          {/* Theme Picker */}
          <div>
            <label className="text-sm">Theme</label>
            <select
              className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 mt-1"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              {Object.entries(themes).map(([key, value]) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </div>

          {/* Stickers */}
          <div>
            <p className="text-sm font-medium mb-1">🖼️ Stickers (click to insert)</p>
            <div className="flex gap-2 flex-wrap">
              {stickers.map((s, i) => (
                <button key={i} onClick={() => toggleSticker(s)} className={`text-xl p-2 rounded ${activeSticker === s ? 'bg-indigo-700' : 'bg-slate-800'}`}>
                  {s}
                </button>
              ))}
              <button onClick={addStickerToEnd} className="text-sm px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white">+ Add to End</button>
            </div>
          </div>

          {/* Parts Editor */}
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

          {/* Add More */}
          <div className="flex gap-3">
            <Button onClick={addBlank} className="bg-pink-600 hover:bg-pink-500">+ Add Blank</Button>
            <Button onClick={addTextPart} className="bg-slate-700 hover:bg-slate-600">+ Add Text</Button>
          </div>

          {/* Preview */}
          <div className={`bg-gradient-to-r ${themes[theme]} p-6 rounded-xl font-mono text-sm border border-slate-700`}>
            <p className="text-lg font-bold mb-2">{title}</p>
            <p>{parts.join(' ')}</p>
          </div>

          {/* Mint Button */}
          <div className="text-center mt-6">
            <Button disabled className="bg-slate-600 cursor-not-allowed opacity-60">
              🪙 Mint Template (Coming Soon)
            </Button>
            <p className="text-xs mt-2 text-slate-400 italic">Soon you’ll be able to mint your own MadFill masterpiece!</p>
          </div>

        </CardContent>
      </Card>
    </Layout>
  )
}
