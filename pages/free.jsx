// pages/free.jsx
import { useState, Fragment } from 'react'
import Head from 'next/head'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { categories } from '../data/templates'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import { Tweet, TwitterShareButton } from 'react-share'

export default function FreeGame() {
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [words, setWords] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const { width, height } = useWindowSize()

  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  const handleInputChange = (i, value) => {
    const newWords = [...words]
    newWords[i] = value
    setWords(newWords)
  }

  const generateSentence = () => {
    const filled = tpl.parts.reduce((acc, part, i) => {
      acc += part
      if (i < tpl.blanks) acc += `**${words[i] || '_'}**`
      return acc
    }, '')
    return filled
  }

  return (
    <>
      <Head><title>Free Game | MadFill</title></Head>
      {submitted && <Confetti width={width} height={height} />}

      <Card className="bg-gradient-to-br from-slate-800 to-indigo-800 text-white shadow-xl rounded-xl">
        <CardHeader>
          <h2 className="text-xl font-bold">🎁 Free Game</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Fill in all the blanks to generate a hilarious card! Then share it with your friends!</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label>Category</label>
              <select className="block w-full bg-slate-900 text-white border rounded px-2 py-1" value={catIdx} onChange={e => setCatIdx(+e.target.value)}>
                {categories.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label>Template</label>
              <select className="block w-full bg-slate-900 text-white border rounded px-2 py-1" value={tplIdx} onChange={e => setTplIdx(+e.target.value)}>
                {selectedCategory.templates.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {[...Array(tpl.blanks)].map((_, i) => (
              <div key={i}>
                <label>Blank {i + 1}</label>
                <input type="text" className="block w-full bg-slate-900 text-white border rounded px-2 py-1" value={words[i] || ''} onChange={e => handleInputChange(i, e.target.value)} />
              </div>
            ))}
          </div>

          <Button onClick={() => setSubmitted(true)} disabled={words.length < tpl.blanks || words.includes('')} className="bg-pink-600 hover:bg-pink-500">
            🎉 Generate Card
          </Button>

          {submitted && (
            <div className="mt-4 bg-slate-900 p-4 rounded border border-slate-700 space-y-2">
              <h3 className="font-bold text-lg">Your MadFill:</h3>
              <p className="whitespace-pre-wrap">{generateSentence()}</p>
              <TwitterShareButton
                url={typeof window !== 'undefined' ? window.location.href : 'https://madfill.fun/free'}
                title={`Check out my MadFill creation: ${generateSentence()}`}
                hashtags={['MadFill', 'FarcasterMini']}
              >
                <Button className="bg-blue-500 hover:bg-blue-400 mt-2">🐦 Share on Warpcast / Twitter</Button>
              </TwitterShareButton>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
