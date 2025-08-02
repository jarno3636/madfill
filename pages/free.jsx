import { useState } from 'react'
import Head from 'next/head'
import { useWindowSize } from 'react-use'
import Confetti from 'react-confetti'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { categories } from '@/data/templates'
import { Twitter, Share2 } from 'lucide-react'

export default function FreeGame() {
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [words, setWords] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const { width, height } = useWindowSize()

  const category = categories[catIdx]
  const template = category.templates[tplIdx]

  const handleWordChange = (i, val) => {
    setWords({ ...words, [i]: val })
  }

  const renderFilledCard = () => {
    return template.parts.map((part, i) => (
      <span key={i}>
        {part}
        {i < template.blanks && (
          <strong className="text-pink-400 mx-1">{words[i] || '____'}</strong>
        )}
      </span>
    ))
  }

  const handleSubmit = () => {
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 5000)
  }

  const shareText = encodeURIComponent(
    `I just played the Free 🧠 MadFill Game!\n\n${template.parts
      .map((part, i) =>
        i < template.blanks
          ? `${part}${words[i] || '____'}`
          : part
      )
      .join('')} \n\nPlay for free: https://madfill.vercel.app/free`
  )

  const farcasterLink = `https://warpcast.com/~/compose?text=${shareText}`
  const twitterLink = `https://twitter.com/intent/tweet?text=${shareText}`

  return (
    <Layout>
      <Head><title>🎁 Free Game | MadFill</title></Head>
      {submitted && <Confetti width={width} height={height} />}

      <Card className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white shadow-2xl rounded-xl">
        <CardHeader>
          <h2 className="text-xl font-bold">🎁 Free MadFill</h2>
          <p className="text-sm text-indigo-200">Fill in the blanks for fun — no wallet needed!</p>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <Button
            onClick={handleSubmit}
            className="bg-pink-500 hover:bg-pink-400 w-full"
          >
            🎉 Submit & View Your Card
          </Button>

          {submitted && (
            <div className="bg-slate-800 p-4 rounded mt-4 border border-pink-500 shadow-inner text-white">
              <h3 className="font-semibold mb-2">Your Completed Card:</h3>
              <p className="text-lg">{renderFilledCard()}</p>
              <div className="mt-4 flex gap-4">
                <a
                  href={twitterLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 bg-blue-500 hover:bg-blue-400 text-white rounded shadow"
                >
                  <Twitter size={16} className="mr-1" />
                  Share on Twitter
                </a>
                <a
                  href={farcasterLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded shadow"
                >
                  <Share2 size={16} className="mr-1" />
                  Share on Farcaster
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  )
}
