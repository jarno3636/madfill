// pages/free.jsx
import { useState, Fragment } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { categories } from '../data/templates'
import Layout from '@/components/Layout'
import ShareButton from '@/components/ShareButton'

export default function FreeGame() {
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [word, setWord] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [finalSentence, setFinalSentence] = useState('')
  const [showResult, setShowResult] = useState(false)

  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  const handlePlay = () => {
    const filled = tpl.parts.map((part, i) => (
      i < tpl.blanks ? `${part}${i == +blankIndex ? word : '[___]'}` : part
    )).join('')
    setFinalSentence(filled)
    setShowResult(true)
  }

  const blankStyle = (active) =>
    `inline-block w-8 text-center border-b-2 ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  return (
    <Layout>
      <Head><title>Free Game – MadFill</title></Head>
      <main className="max-w-3xl mx-auto p-6 space-y-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="bg-gradient-to-br from-purple-800 to-indigo-900 text-white shadow-2xl p-6 rounded-xl">
            <h2 className="text-2xl font-bold mb-2">🎁 Play MadFill for Free</h2>
            <p className="text-sm mb-4">Enjoy a completely free round of MadFill — just for fun!</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {[['Category', catIdx, setCatIdx, categories.map((c, i) => ({ label: c.name, value: i }))],
                ['Template', tplIdx, setTplIdx, selectedCategory.templates.map((t, i) => ({ label: t.name, value: i }))]].map(([label, val, setVal, options]) => (
                <div key={label}>
                  <label>{label}</label>
                  <select className="block w-full mt-1 bg-slate-900 text-white border rounded px-2 py-1" value={val} onChange={e => setVal(+e.target.value)}>
                    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label>Your Word</label>
              <input type="text" className="block w-full mt-1 bg-slate-900 text-white border rounded px-2 py-1" value={word} onChange={e => setWord(e.target.value)} />
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm mb-2">
              {tpl.parts.map((part, i) => (
                <Fragment key={i}>
                  <span>{part}</span>
                  {i < tpl.blanks && (
                    <span className={blankStyle(i === +blankIndex)} onClick={() => setBlankIndex(String(i))}>{i}</span>
                  )}
                </Fragment>
              ))}
            </div>
            <p className="text-sm mb-4">Selected Blank: <strong>{blankIndex}</strong></p>

            <button
              onClick={handlePlay}
              disabled={!word}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded shadow"
            >
              🎮 Play Free Round
            </button>

            {showResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 text-center">
                <h3 className="text-lg font-bold mb-2">Your Mad Sentence:</h3>
                <p className="bg-slate-800 border border-slate-600 p-4 rounded-xl shadow inline-block">{finalSentence}</p>
                <ShareButton sentence={finalSentence} word={word} />
              </motion.div>
            )}
          </div>
        </motion.div>
      </main>
    </Layout>
  )
}
