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
import { fetchFarcasterProfile } from '@/lib/neynar'

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
          <pre className="mt-4 p-4 bg-slate-100 text-sm text-red-800 rounded overflow-x-auto">
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
  const [feeUsd, setFeeUsd] = useState(1.0)
  const [deadline, setDeadline] = useState(null)
  const [recentWinners, setRecentWinners] = useState([])
  const [shareText, setShareText] = useState('')
  const [busy, setBusy] = useState(false)
  const { width, height } = useWindowSize()
  const [totalRounds, setTotalRounds] = useState(null)

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [profile, setProfile] = useState(null)
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

  useEffect(() => {
    async function loadProfile() {
      const fid = localStorage.getItem('fc_fid')
      if (fid) {
        const p = await fetchFarcasterProfile(fid)
        setProfile(p)
      }
    }
    loadProfile()

    async function loadTotalRounds() {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
      const count = await ct.pool1Count()
      setTotalRounds(Number(count))
    }
    loadTotalRounds()
  }, [])

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
        setStatus('🚀 Creating new round & submitting…')
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
        setStatus('✍️ Submitting your entry…')
        const tx2 = await ct.joinPool1(newId, word, signer.address.slice(0, 6), {
          value: ethers.parseEther('0.001')
        })
        await tx2.wait()
      }

      setStatus(`✅ Entry for Round ${newId} submitted!`)
      const preview = tpl.parts.map((part, i) => i < tpl.blanks ? `${part}${i === +blankIndex ? word : '____'}` : part).join('')
      setShareText(encodeURIComponent(`I just entered MadFill Round #${newId} 💥\n\n${preview}\n\nPlay: https://madfill.vercel.app`))

    } catch (e) {
      const message = e?.message?.split('(')[0]?.trim() || 'Something went wrong.'
      setStatus(`❌ ${message}`)
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active => `inline-block w-8 text-center border-b-2 ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  return (
    <ErrorBoundary>
      <Layout>
        <Head><title>MadFill</title></Head>
        {shareText && <Confetti width={width} height={height} />}

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="bg-purple-800 text-white rounded p-6 mb-6 shadow-xl">
            <h3 className="text-xl font-extrabold mb-3">🧠 What is MadFill?</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><strong>Create a Round:</strong> Pick a template, add your first word, and launch the game. Your word sets the tone.</li>
              <li><strong>Join a Round:</strong> Other players jump in and fill in the remaining blanks. Each entry costs a small fee (you set it!).</li>
              <li><strong>Win:</strong> At the end of the round, a random participant is chosen to win the prize pool.</li>
              <li><strong>Pool 2 Showdown:</strong> Think you can beat the original? Submit a challenger card and let the community vote!</li>
            </ul>
            {profile && (
              <div className="mt-4 flex items-center gap-2">
                <img src={profile.pfp_url} alt="Avatar" className="w-8 h-8 rounded-full border border-white" />
                <p className="text-sm text-yellow-200">🎉 Welcome back @{profile.username}!</p>
              </div>
            )}
            {totalRounds !== null && (
              <p className="text-xs text-pink-200 mt-2">🔥 {totalRounds} rounds created so far. Join the madness!</p>
            )}
          </Card>

          <Card className="bg-gradient-to-r from-yellow-500 to-red-500 text-white rounded p-6 mb-6 shadow-lg">
            <h3 className="text-lg font-bold mb-2">💰 Fee Structure</h3>
            <ul className="list-disc list-inside text-sm">
              <li><strong>Entry Fee:</strong> Set in USD when you create the round. Automatically converted to BASE.</li>
              <li><strong>Claim Fee:</strong> 0.5% of the winnings.</li>
              <li><strong>Dev Cut:</strong> 0.5% of all submissions and claims go to the dev wallet to support the game.</li>
              <li><strong>Flexibility:</strong> You choose how expensive the round is, from 0.25 to 10 USD.</li>
            </ul>
            <p className="text-sm mt-4 text-white/80">🧩 Want to play with friends? Create your round and tag them on Farcaster!</p>
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
              {status && (
                <motion.div
                  className="bg-slate-700 text-white p-3 rounded text-sm max-w-full overflow-x-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {status}
                </motion.div>
              )}

              <input
                type="text"
                maxLength={12}
                placeholder="Round Name (optional)"
                className="w-full bg-slate-900 text-white border rounded px-2 py-1"
                value={roundName}
                onChange={e => setRoundName(e.target.value)}
                disabled={busy}
              />

              <div className="flex gap-4">
                <div>
                  <label className="text-sm block mb-1">📚 Category</label>
                  <select
                    className="bg-slate-900 text-white border rounded px-2 py-1"
                    value={catIdx}
                    onChange={e => setCatIdx(+e.target.value)}
                    disabled={busy}
                  >
                    {categories.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm block mb-1">📝 Template</label>
                  <select
                    className="bg-slate-900 text-white border rounded px-2 py-1"
                    value={tplIdx}
                    onChange={e => setTplIdx(+e.target.value)}
                    disabled={busy}
                  >
                    {selectedCategory.templates.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <p className="text-sm bg-slate-700 p-3 rounded">📄 {tpl.parts.map((p, i) => i < tpl.blanks ? `${p}____` : p).join('')}</p>

              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm">💬 Select blank position:</span>
                {Array.from({ length: tpl.blanks }).map((_, i) => (
                  <span
                    key={i}
                    className={blankStyle(i === +blankIndex)}
                    onClick={() => setBlankIndex(i.toString())}
                  >{i + 1}</span>
                ))}
              </div>

              <input
                type="text"
                placeholder="Your word..."
                className="w-full bg-slate-900 text-white border rounded px-2 py-1"
                value={word}
                onChange={e => setWord(e.target.value)}
                disabled={busy}
              />

              <div className="flex gap-4 flex-wrap">
                <div>
                  <label className="text-sm block mb-1">🕓 Duration (days)</label>
                  <select
                    className="bg-slate-900 text-white border rounded px-2 py-1"
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    disabled={busy}
                  >
                    {durations.map((d, i) => (
                      <option key={i} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm block mb-1">💵 Entry Fee (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.25"
                    max="10"
                    value={feeUsd}
                    onChange={e => setFeeUsd(Number(e.target.value))}
                    className="bg-slate-900 text-white border rounded px-2 py-1"
                    disabled={busy}
                  />
                </div>
              </div>

              <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={handleUnifiedSubmit} disabled={busy}>
                {roundId ? 'Join Round' : 'Create Round & Submit'}
              </Button>
            </CardContent>
          </Card>
        </main>

        <Footer />
      </Layout>
    </ErrorBoundary>
  )
}
