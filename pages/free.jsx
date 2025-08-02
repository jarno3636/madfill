import { useState } from 'react'
import Head from 'next/head'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWindowSize } from 'react-use'
import Confetti from 'react-confetti'
import { categories } from '../data/templates'
import StyledCard from '@/components/StyledCard'

export default function FreeGame() {
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [words, setWords] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  const { width, height } = useWindowSize()

  const category = categories[catIdx]
  const template = category.templates[tplIdx]

  const handleWordChange = (i, val) => {
    setWords({ ...words, [i]: val })
  }

  const handleSubmit = () => {
    setSubmitted(true)
    setCopied(false)
  }

  const handleRemix = () => {
    setSubmitted(false)
  }

  const filledText = template.parts
    .map((part, i) =>
      i < template.blanks ? `${part}${words[i] || '____'}` : part
    )
    .join('')

  const shareText = encodeURIComponent(
    `I just played the Free 🧠 MadFill Game!\n\n${filledText}\n\nPlay for free: https://madfill.vercel.app/free`
  )

  const farcasterLink = `https://warpcast.com/~/compose?text=${shareText}`
  const twitterLink = `https://twitter.com/intent/tweet?text=${shareText}`

  const handleCopy = () => {
    navigator.clipboard.writeText(filledText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Layout>
      <Head><title>🎁 Free Game | MadFill</title></Head>
      {submitted && <Confetti width={width} height={height} />}

      <Card className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white shadow-2xl rounded-xl">
        <CardHeader>
          <h2 className="text-xl font-bold">🎁 Free MadFill</h2>
          <p className="text-sm text-indigo-200">Fill in the blanks for fun — no wallet needed!</p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Selectors */}
          {!submitted && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label>Category</label>
                  <select
                    className="w-full mt-1 bg-slate-900 border rounded px-2 py-1"
                    value={catIdx}
                    onChange={(e) => {
                      setCatIdx(+e.target.value)
                      setTplIdx(0)
                      setWords({})
                    }}
                  >
                    {categories.map((c, i) => (
                      <option key={i} value={i}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Template</label>
                  <select
                    className="w-full mt-1 bg-slate-900 border rounded px-2 py-1"
                    value={tplIdx}
                    onChange={(e) => {
                      setTplIdx(+e.target.value)
                      setWords({})
                    }}
                  >
                    {category.templates.map((t, i) => (
                      <option key={i} value={i}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Word Inputs */}
              <div className="space-y-2">
                {Array.from({ length: template.blanks }).map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    placeholder={`Word ${i + 1}`}
                    className="w-full bg-slate-900 text-white border rounded px-2 py-1"
                    value={words[i] || ''}
                    onChange={(e) => handleWordChange(i, e.target.value)}
                  />
                ))}
              </div>

              {/* Live Preview */}
              <div className="bg-slate-800 p-4 rounded border border-slate-600 text-white shadow-inner mt-4">
                <h3 className="font-semibold mb-2">🪄 Live Preview:</h3>
                <StyledCard parts={template.parts} blanks={template.blanks} words={words} />
              </div>

              <Button
                onClick={handleSubmit}
                className="bg-pink-500 hover:bg-pink-400 w-full mt-4"
              >
                🎉 Submit & View Your Card
              </Button>
            </>
          )}

          {/* Completed Card */}
          {submitted && (
            <div className="bg-slate-800 p-4 rounded border border-pink-500 shadow-inner space-y-4 text-white">
              <h3 className="font-semibold text-lg">🧾 Your Completed Card:</h3>
              <StyledCard parts={template.parts} blanks={template.blanks} words={words} />

              <div className="flex flex-wrap gap-3 mt-4">
                <a
                  href={twitterLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white"
                >
                  🐦 Share on Twitter
                </a>
                <a
                  href={farcasterLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white"
                >
                  🌀 Share on Farcaster
                </a>
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-white"
                >
                  {copied ? '✅ Copied!' : '📋 Copy Text'}
                </button>
                <button
                  onClick={handleRemix}
                  className="px-4 py-2 bg-pink-500 hover:bg-pink-400 rounded text-white"
                >
                  🔁 Remix This Card
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  )
}
