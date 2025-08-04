// pages/index.jsx
import React, { Component, useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { categories, durations } from '../data/templates'
import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
import { Tooltip } from '@/components/ui/tooltip'
import Link from 'next/link'

// --- ErrorBoundary to catch any render errors ---
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
  const [deadline, setDeadline] = useState(null)
  const [recentWinners, setRecentWinners] = useState([])
  const [shareText, setShareText] = useState('')
  const [busy, setBusy] = useState(false)
  const { width, height } = useWindowSize()
  const ENTRY_FEE = '0.001'

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  // load deadline
  useEffect(() => {
    if (!roundId) return setDeadline(null)
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const ct = new ethers.Contract(
      process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
      abi,
      provider
    )
    ct.rounds(BigInt(roundId))
      .then(info => setDeadline(info.sd))
      .catch(() => setDeadline(null))
  }, [roundId])

  // load recent winners
  useEffect(() => {
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(
          process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
          abi,
          provider
        )
        const evs = await ct.queryFilter(ct.filters.Draw1(), 0, 'latest')
        setRecentWinners(
          evs
            .slice(-5)
            .reverse()
            .map(e => ({
              roundId: e.args.id.toNumber(),
              winner: e.args.winner,
            }))
        )
      } catch (err) {
        console.error('Failed to load winners', err)
      }
    })()
  }, [])

  async function handleUnifiedSubmit() {
    if (!word) {
      setStatus('❌ Please enter a word before submitting.')
      return
    }

    try {
      setBusy(true)
      setStatus('')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )

      let newId = roundId

      // 1) Create round (gas only)
      if (!roundId) {
        setStatus('⏳ Creating round…')
        const tx = await ct.start(
          tpl.blanks,
          ethers.parseEther(ENTRY_FEE),
          BigInt(duration * 86400)
        )
        await tx.wait()
        const ev = await ct.queryFilter(ct.filters.Started(), 0, 'latest')
        newId = ev[ev.length - 1].args.id.toString()
        setRoundId(newId)
        const info = await ct.rounds(BigInt(newId))
        setDeadline(info.sd)
        localStorage.setItem(`madfill-roundname-${newId}`, roundName || '')
      }

      // 2) Submit entry (pay fee)
      setStatus('⏳ Submitting entry…')
      const data = ethers.encodeBytes32String(word)
      const tx2 = await ct.submitPaid(
        BigInt(newId),
        Number(blankIndex),
        data,
        { value: ethers.parseEther(ENTRY_FEE) }
      )
      await tx2.wait()

      setStatus(`✅ Round ${newId} entry submitted!`)
      // share preview
      const preview = tpl.parts
        .map((part, i) =>
          i < tpl.blanks
            ? `${part}${i === Number(blankIndex) ? word : '____'}`
            : part
        )
        .join('')
      setShareText(
        encodeURIComponent(
          `I just entered MadFill!

${preview}

Play: https://madfill.vercel.app`
        )
      )
    } catch (e) {
      const msg = (e?.message || '').toLowerCase()
      if (msg.includes('denied')) {
        setStatus('❌ Transaction cancelled.')
      } else if (
        msg.includes('execution reverted') ||
        msg.includes('require(false)')
      ) {
        setStatus('❌ Transaction failed on-chain.')
      } else {
        setStatus('❌ ' + (e.message || 'Unknown error'))
      }
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active =>
    `inline-block w-8 text-center border-b-2 ${
      active ? 'border-white' : 'border-slate-400'
    } cursor-pointer mx-1`

  return (
    <ErrorBoundary>
      <Layout>
        <Head>
          <title>MadFill</title>
        </Head>

        {/** Confetti on win **/}
        <Confetti width={width} height={height} />

        {/* Fee breakdown - now extra fun! */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-gradient-to-r from-yellow-500 to-red-500 text-white rounded p-6 mb-6 shadow-lg">
            <h3 className="text-lg font-bold mb-2">💰 Fee Breakdown</h3>
            <ul className="list-disc list-inside text-sm">
              <li><strong>Create Round:</strong> just gas to kick things off!</li>
              <li><strong>Enter Pool:</strong> <strong>{ENTRY_FEE} BASE</strong> per word (0.5% cut to platform)</li>
              <li><strong>Winner Claim:</strong> 0.5% cut on payout</li>
            </ul>
          </Card>
        </motion.div>

        <main className="max-w-4xl mx-auto p-6 space-y-8">
          {/* What Is MadFill? - now extra playful */}
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} transition={{ duration: 0.4 }}>
            <Card className="bg-purple-800 text-white shadow-2xl rounded-xl">
              <CardHeader>
                <h2 className="text-2xl font-extrabold">🎮 What Is MadFill?</h2>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>MadFill is your ticket to the silliest on-chain word party! 🎉</p>
                <p>Pick a hilarious template, fill in the blanks, and watch the fun unfold.</p>
                <p>👛 Create a new round (gas only), then submit your word for just <strong>{ENTRY_FEE} BASE</strong>. Winner takes the pot!</p>
                <p>🕹️ All action happens on-chain, so you know it’s fair and transparent.</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Setup & Play */}
          <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{!roundId ? '🚀 Create & Play' : `🔄 Round #${roundId}`}</h2>
              <Tooltip text="0.5% cut on entry & claim" />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* selectors... */}
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  ['Category', catIdx, setCatIdx, categories],
                  ['Template', tplIdx, setTplIdx, selectedCategory.templates],
                  ['Duration', duration, setDuration, durations]
                ].map(([lbl, val, fn, opts]) => (
                  <div key={lbl}>
                    <label className="block text-sm mb-1">{lbl}</label>
                    <select
                      className="w-full mt-1 bg-slate-900 text-white border rounded px-2 py-1"
                      value={val}
                      onChange={e => fn(+e.target.value)}
                      disabled={busy}
                    >
                      {opts.map((o,i)=>(
                        <option key={i} value={o.value ?? i}>
                          {o.label ?? o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <input
                type="text"
                maxLength={12}
                placeholder="Round Name (optional)"
                className="w-full bg-slate-900 text-white border rounded px-2 py-1"
                value={roundName}
                onChange={e => setRoundName(e.target.value)}
                disabled={busy}
              />

              <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm">
                {tpl.parts.map((part,i)=>(
                  <Fragment key={i}>
                    <span>{part}</span>
                    {i<tpl.blanks && (
                      <span
                        className={blankStyle(i===+blankIndex)}
                        onClick={()=>setBlankIndex(String(i))}
                      >{i}</span>
                    )}
                  </Fragment>
                ))}
              </div>

              <p className="text-sm">Selected blank: <strong>{blankIndex}</strong></p>

              <input
                type="text"
                placeholder="Type your wild word here!"
                value={word}
                onChange={e=>setWord(e.target.value)}
                className="w-full bg-slate-900 text-white border rounded px-2 py-1"
                disabled={busy}
              />

              <Button
                onClick={handleUnifiedSubmit}
                disabled={busy || !word}
                className="bg-indigo-600 hover:bg-indigo-500 w-full"
              >
                {!roundId ? '🚀 Launch Round' : '🪪 Enter Pool'}
              </Button>

              {status && <p className="text-sm mt-2">{status}</p>}

              {roundId && shareText && (
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

          {/* Recent Winners */}
          <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
            <CardHeader><h2 className="text-xl font-bold">🎉 Recent Winners</h2></CardHeader>
            <CardContent className="text-sm space-y-1">
              {recentWinners.length === 0 ? (
                <p>No winners yet. Be the first!</p>
              ) : (
                recentWinners.map((w,i)=>(
                  <p key={i}>
                    <strong>{localStorage.getItem(`madfill-roundname-${w.roundId}`) || `Round #${w.roundId}`}</strong> → <code>{w.winner}</code>
                  </p>
                ))
              )}
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="mt-16 py-6 text-center bg-slate-900 text-slate-300">
          <p>© {new Date().getFullYear()} MadFill • Built on Base</p>
          <p className="text-xs mt-2">
            <Link href="/about"><a className="underline">About</a></Link> · <Link href="/terms"><a className="underline">Terms</a></Link>
          </p>
        </footer>
      </Layout>
    </ErrorBoundary>
  )
}
