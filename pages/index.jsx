// pages/index.jsx
import React, { Component, useState, useEffect, Fragment, useRef } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryV2_ABI.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { categories, durations } from '../data/templates'
import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
import { Tooltip } from '@/components/ui/tooltip'
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
  const [logs, setLogs] = useState([])
  const loggerRef = useRef(null)

  const [roundId, setRoundId] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [roundName, setRoundName] = useState('')
  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(durations[0].value)
  const [feeUsd, setFeeUsd] = useState(1.0)
  const [deadline, setDeadline] = useState(null)
  const [shareText, setShareText] = useState('')
  const [busy, setBusy] = useState(false)
  const { width, height } = useWindowSize()
  const [totalRounds, setTotalRounds] = useState(null)

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [profile, setProfile] = useState(null)
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  const log = (msg) => {
    setLogs(prev => [...prev, msg])
    setTimeout(() => {
      if (loggerRef.current) {
        loggerRef.current.scrollTop = loggerRef.current.scrollHeight
      }
    }, 100)
  }

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
      log('🔍 Connecting to wallet…')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      let newId = roundId

      if (!roundId) {
        log('🚀 Creating round with template:')
        log(` - Name: ${roundName}`)
        log(` - Fee: $${feeUsd}`)
        log(` - Duration: ${duration} days`)
        log(` - Parts: ${tpl.parts.length} pieces`)
        const tx = await ct.createPool1(
          roundName || `Untitled`,
          tpl.parts,
          word,
          signer.address.slice(0, 6),
          feeUsd,
          duration * 86400
        )
        log('📡 Waiting for transaction…')
        await tx.wait()
        const poolCount = await ct.pool1Count()
        newId = (Number(poolCount) - 1).toString()
        setRoundId(newId)
        const info = await ct.getPool1Info(newId)
        setDeadline(Number(info.deadline))
        localStorage.setItem(`madfill-roundname-${newId}`, roundName)
        log(`✅ Round ${newId} created.`)
      } else {
        log(`✍️ Joining existing Round #${newId} with word: ${word}`)
        const tx2 = await ct.joinPool1(newId, word, signer.address.slice(0, 6), {
          value: ethers.parseEther('0.001')
        })
        log('⏳ Waiting for join confirmation…')
        await tx2.wait()
        log(`✅ Joined Round ${newId}`)
      }

      setStatus(`✅ Entry for Round ${newId} submitted!`)
      const preview = tpl.parts.map((part, i) => i < tpl.blanks ? `${part}${i === +blankIndex ? word : '____'}` : part).join('')
      setShareText(encodeURIComponent(`I just entered MadFill Round #${newId} 💥\n\n${preview}\n\nPlay: https://madfill.vercel.app`))
    } catch (e) {
      console.error('[Error]', e)
      log(`❌ Error: ${e.message || 'Unknown'}`)
      const message = e?.message?.split('(')[0]?.trim() || 'Something went wrong.'
      setStatus(`❌ ${message}`)
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active =>
    `inline-block w-16 text-center border-b-2 font-bold text-lg ${
      active ? 'border-white' : 'border-slate-400'
    } cursor-pointer mx-1`

  const renderTemplatePreview = () => (
    <p className="text-base bg-slate-700 p-4 rounded-xl leading-relaxed shadow-md border border-indigo-400">
      📄 {tpl.parts.map((p, i) => {
        if (i < tpl.blanks) {
          return (
            <Fragment key={i}>
              {p}
              <span
                className={blankStyle(i === +blankIndex)}
                onClick={() => setBlankIndex(i.toString())}
              >
                {i === +blankIndex ? (word || '____') : '____'}
              </span>
            </Fragment>
          )
        } else {
          return p
        }
      })}
    </p>
  )

  return (
    <ErrorBoundary>
      <Layout>
        <Head><title>MadFill</title></Head>
        {shareText && <Confetti width={width} height={height} />}

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="bg-purple-800 text-white rounded p-6 mb-6 shadow-xl">
            <h3 className="text-xl font-extrabold mb-3">🧠 What is MadFill?</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><strong>Create a Round:</strong> Pick a template, add your first word, and launch the game.</li>
              <li><strong>Join a Round:</strong> Fill in the remaining blanks. Pay a small fee. Win big.</li>
              <li><strong>Win:</strong> At the deadline, one winner is randomly selected.</li>
              <li><strong>Pool 2:</strong> Submit a challenger card and let the community vote!</li>
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
        </motion.div>

        <main className="max-w-4xl mx-auto p-6 space-y-8">
          <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

              <div className="flex flex-col sm:flex-row sm:gap-4">
                <div className="flex-1">
                  <label className="text-sm block mb-1">📚 Category</label>
                  <select
                    className="w-full bg-slate-900 text-white border rounded px-2 py-1"
                    value={catIdx}
                    onChange={e => setCatIdx(+e.target.value)}
                    disabled={busy}
                  >
                    {categories.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 mt-4 sm:mt-0">
                  <label className="text-sm block mb-1">📝 Template</label>
                  <select
                    className="w-full bg-slate-900 text-white border rounded px-2 py-1"
                    value={tplIdx}
                    onChange={e => setTplIdx(+e.target.value)}
                    disabled={busy}
                  >
                    {selectedCategory.templates.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {renderTemplatePreview()}

              <input
                type="text"
                placeholder="Your word..."
                className="w-full bg-slate-900 text-white border rounded px-2 py-1"
                value={word}
                onChange={e => setWord(e.target.value)}
                disabled={busy}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm block mb-1">🕓 Duration (days)</label>
                  <select
                    className="w-full bg-slate-900 text-white border rounded px-2 py-1"
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
                    type="range"
                    min="0.25"
                    max="10"
                    step="0.25"
                    value={feeUsd}
                    onChange={e => setFeeUsd(Number(e.target.value))}
                    className="w-full"
                    disabled={busy}
                  />
                  <p className="text-sm mt-1">Current: ${feeUsd.toFixed(2)}</p>
                </div>
              </div>

              <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={handleUnifiedSubmit} disabled={busy}>
                {roundId ? 'Join Round' : 'Create Round & Submit'}
              </Button>

              <div className="bg-black/40 text-green-200 text-xs mt-6 max-h-40 overflow-y-auto p-3 rounded border border-green-400" ref={loggerRef}>
                {logs.map((msg, i) => (
                  <div key={i}>→ {msg}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>

        <Footer />
      </Layout>
    </ErrorBoundary>
  )
}
