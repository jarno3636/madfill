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
  const [feeUsd, setFeeUsd] = useState(1)
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

      let newId = roundId

      if (!roundId) {
        setStatus('🚀 Creating new round...')
        const tx = await ct.createPool1(
          roundName || `Untitled`,
          tpl.parts,
          word,
          signer.address.slice(0, 6),
          feeUsd,
          duration * 86400
        )
        await tx.wait()
        const poolCount = await ct.pool1Count()
        newId = (Number(poolCount) - 1).toString()
        setRoundId(newId)
        const info = await ct.getPool1Info(newId)
        setDeadline(Number(info.deadline))
        localStorage.setItem(`madfill-roundname-${newId}`, roundName)
      } else {
        setStatus('✍️ Submitting your entry...')
        const tx2 = await ct.joinPool1(newId, word, signer.address.slice(0, 6), {
          value: ethers.parseEther('0.001')
        })
        await tx2.wait()
      }

      setStatus(`✅ Entry for Round ${newId} submitted!`)
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
            <h3 className="text-lg font-bold mb-2">💰 Game Details</h3>
            <ul className="list-disc list-inside text-sm">
              <li><strong>Step 1:</strong> Pick a template and create your round with your first word.</li>
              <li><strong>Step 2:</strong> Other players submit one word each for a small fee.</li>
              <li><strong>Step 3:</strong> Winner is chosen randomly from all entries!</li>
              <li><strong>Pool 2:</strong> Challenge completed cards and let the community vote.</li>
              <li><strong>Fees:</strong> You choose the entry fee in USD. A 0.5% fee is collected on entries and payouts.</li>
            </ul>
          </Card>
        </motion.div>

        <main className="max-w-4xl mx-auto p-6 space-y-8">
          <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {!roundId ? '🚀 Create Round & Submit' : `🔄 Round #${roundId}`}
              </h2>
              <Tooltip text="0.5% cut on entry & claim" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                {[['Category', catIdx, setCatIdx, categories], ['Template', tplIdx, setTplIdx, selectedCategory.templates], ['Duration', duration, setDuration, durations]].map(([lbl, val, fn, opts]) => (
                  <div key={lbl}>
                    <label className="block text-sm mb-1">{lbl}</label>
                    <select className="w-full mt-1 bg-slate-900 text-white border rounded px-2 py-1" value={val} onChange={e => fn(+e.target.value)} disabled={busy}>
                      {opts.map((o, i) => <option key={i} value={o.value ?? i}>{o.label ?? o.name}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="block text-sm mb-1">Entry Fee (USD)</label>
                  <input type="number" min="0.25" max="10" step="0.25" className="w-full bg-slate-900 text-white border rounded px-2 py-1" value={feeUsd} onChange={e => setFeeUsd(Number(e.target.value))} disabled={busy} />
                </div>
              </div>

              <input type="text" maxLength={12} placeholder="Round Name (optional)" className="w-full bg-slate-900 text-white border rounded px-2 py-1" value={roundName} onChange={e => setRoundName(e.target.value)} disabled={busy} />

              <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm">
                {tpl.parts.map((part, i) => (
                  <Fragment key={i}>
                    <span>{part}</span>
                    {i < tpl.blanks && (
                      <span className={blankStyle(i === +blankIndex)} onClick={() => setBlankIndex(String(i))}>{i}</span>
                    )}
                  </Fragment>
                ))}
              </div>

              <p className="text-sm">Selected blank: <strong>{blankIndex}</strong></p>

              <input type="text" placeholder="Type your wild word here!" value={word} onChange={e => setWord(e.target.value)} className="w-full bg-slate-900 text-white border rounded px-2 py-1" disabled={busy} />

              <Button onClick={handleUnifiedSubmit} disabled={busy || !word} className="bg-indigo-600 hover:bg-indigo-500 w-full">
                {!roundId ? '🚀 Create Round & Submit' : '🪪 Submit Entry'}
              </Button>

              {status && <p className="text-sm mt-2 text-yellow-300">{status}</p>}
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
        </main>

        <Footer />
      </Layout>
    </ErrorBoundary>
  )
}
