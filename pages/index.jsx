// pages/index.jsx
import React, { Component, useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryV2_ABI.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { categories, durations } from '../data/templates'
import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
import { Tooltip } from '@/components/ui/tooltip'
import Link from 'next/link'
import Footer from '@/components/Footer'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, error: err }
  }
  componentDidCatch(err, info) {
    console.error('ErrorBoundary caught:', err, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-red-600">Something went wrong.</h2>
          <pre className="mt-4 p-4 bg-slate-100 text-sm text-red-800 rounded">
            {this.state.error?.toString()}
          </pre>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Home() {
  const [status, setStatus] = useState('')
  const [roundId, setRoundId] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [roundName, setRoundName] = useState('')
  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(durations[0].value)
  const [entryUsd, setEntryUsd] = useState(1)
  const [deadline, setDeadline] = useState(null)
  const [recentWinners, setRecentWinners] = useState([])
  const [shareText, setShareText] = useState('')
  const [busy, setBusy] = useState(false)
  const { width, height } = useWindowSize()

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  useEffect(() => {
    if (!roundId) return setDeadline(null)
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
    ct.getPool1Info(BigInt(roundId))
      .then(info => setDeadline(Number(info.deadline)))
      .catch(() => setDeadline(null))
  }, [roundId])

  async function handleUnifiedSubmit() {
    if (!word) return setStatus('❌ Please enter a word.')

    try {
      setBusy(true)
      setStatus('')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      setStatus('🚀 Creating and entering round…')
      const tx = await ct.createPool1(
        roundName || `Untitled`,
        tpl.parts,
        word,
        signer.address.slice(0, 6),
        entryUsd,
        duration * 86400
      )
      await tx.wait()

      const poolCount = await ct.pool1Count()
      const newId = (Number(poolCount) - 1).toString()
      setRoundId(newId)
      const info = await ct.getPool1Info(newId)
      setDeadline(Number(info.deadline))
      localStorage.setItem(`madfill-roundname-${newId}`, roundName)

      setStatus(`✅ Round ${newId} created and entered!`)
      const preview = tpl.parts.map((part, i) => i < tpl.blanks ? `${part}${i === +blankIndex ? word : '____'}` : part).join('')
      setShareText(encodeURIComponent(`I just entered MadFill Round #${newId} 💥\n\n${preview}\n\nPlay: https://madfill.vercel.app`))

    } catch (e) {
      setStatus('❌ ' + (e.message || 'Unknown error'))
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active => `inline-block w-8 text-center border-b-2 ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  return (
    <ErrorBoundary>
      <Layout>
        <Head>
          <title>MadFill</title>
        </Head>
        {shareText && <Confetti width={width} height={height} />}

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="bg-gradient-to-r from-yellow-500 to-red-500 text-white rounded p-6 mb-6 shadow-lg">
            <h3 className="text-lg font-bold mb-2">📜 How It Works</h3>
            <ul className="list-disc list-inside text-sm">
              <li>Create a round with a silly sentence and your first word</li>
              <li>Set how much others will pay to join (in USD, converted to BASE)</li>
              <li>Other players enter with their own words to complete the sentence</li>
              <li>One random winner gets the pot! 🏆</li>
              <li>Challenge cards in Pool 2 and let voters decide! 🥊</li>
              <li><strong>0.5% platform fee applies to entries and claims</strong></li>
            </ul>
          </Card>
        </motion.div>

        <main className="max-w-4xl mx-auto p-6 space-y-8">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} transition={{ duration: 0.4 }}>
            <Card className="bg-purple-800 text-white shadow-2xl rounded-xl">
              <CardHeader>
                <h2 className="text-2xl font-extrabold">🧠 Create & Enter a MadFill Round</h2>
              </CardHeader>
              <CardContent className="text-sm space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label>Category</label>
                    <select value={catIdx} onChange={e=>setCatIdx(+e.target.value)} className="w-full bg-slate-900 text-white border rounded px-2 py-1">
                      {categories.map((cat,i)=>(<option key={i} value={i}>{cat.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label>Template</label>
                    <select value={tplIdx} onChange={e=>setTplIdx(+e.target.value)} className="w-full bg-slate-900 text-white border rounded px-2 py-1">
                      {selectedCategory.templates.map((tpl,i)=>(<option key={i} value={i}>{tpl.name}</option>))}
                    </select>
                  </div>
                </div>

                <input type="text" maxLength={12} placeholder="Round Name (optional)" className="w-full bg-slate-900 text-white border rounded px-2 py-1" value={roundName} onChange={e=>setRoundName(e.target.value)} disabled={busy} />

                <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm">
                  {tpl.parts.map((part,i)=>(<Fragment key={i}><span>{part}</span>{i<tpl.blanks && (<span className={blankStyle(i===+blankIndex)} onClick={()=>setBlankIndex(String(i))}>{i}</span>)}</Fragment>))}
                </div>

                <input type="text" placeholder="Your word for the blank!" value={word} onChange={e=>setWord(e.target.value)} className="w-full bg-slate-900 text-white border rounded px-2 py-1" disabled={busy} />

                <label>Entry Fee (USD)</label>
                <input type="number" value={entryUsd} onChange={e=>setEntryUsd(+e.target.value)} className="w-full bg-slate-900 text-white border rounded px-2 py-1" disabled={busy} min={0.1} step={0.1} />

                <label>Round Duration</label>
                <select className="w-full bg-slate-900 text-white border rounded px-2 py-1" value={duration} onChange={e=>setDuration(+e.target.value)}>
                  {durations.map((d)=>(<option key={d.value} value={d.value}>{d.label}</option>))}
                </select>

                <Button onClick={handleUnifiedSubmit} disabled={busy || !word} className="bg-indigo-600 hover:bg-indigo-500 w-full">
                  🚀 Create & Enter Round
                </Button>
                {status && <p className="text-yellow-200 mt-2">{status}</p>}
                {shareText && (
                  <div className="mt-4 space-y-2">
                    <p className="font-semibold">📣 Spread the word:</p>
                    <div className="flex flex-wrap gap-2">
                      <a href={`https://twitter.com/intent/tweet?text=${shareText}`} target="_blank" rel="noopener noreferrer" className="bg-blue-600 px-4 py-2 rounded">🐦 Twitter</a>
                      <a href={`https://warpcast.com/~/compose?text=${shareText}`} target="_blank" rel="noopener noreferrer" className="bg-purple-600 px-4 py-2 rounded">🌀 Farcaster</a>
                      <Link href={`/round/${roundId}`}><a className="bg-slate-700 px-4 py-2 rounded">📜 View</a></Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </main>

        <Footer/>
      </Layout>
    </ErrorBoundary>
  )
}
