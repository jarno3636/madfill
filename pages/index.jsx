import React, { Component, useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
// import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { categories } from '../data/templates'
import Layout from '@/components/Layout'
// import { motion } from 'framer-motion'
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
  const [duration, setDuration] = useState(1)
  const [deadline, setDeadline] = useState(null)
  const [recentWinners, setRecentWinners] = useState([])
  const [shareText, setShareText] = useState('')
  const [busy, setBusy] = useState(false)
  // const [showConfetti, setShowConfetti] = useState(false)
  const { width, height } = useWindowSize()
  const ENTRY_FEE = '0.001'

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const selectedCategory = categories[catIdx] ?? {}
  const tpl = selectedCategory.templates?.[tplIdx] ?? { blanks: 0, parts: [] }

  const durations = [
    { label: '1 Day', value: 1 }, { label: '2 Days', value: 2 },
    { label: '3 Days', value: 3 }, { label: '4 Days', value: 4 },
    { label: '5 Days', value: 5 }, { label: '6 Days', value: 6 },
    { label: '1 Week', value: 7 },
  ]

  useEffect(() => {
    if (!roundId) return setDeadline(null)
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
      abi,
      provider
    )
    contract.rounds(BigInt(roundId))
      .then(info => setDeadline(info.sd.toNumber()))
      .catch(() => setDeadline(null))
  }, [roundId])

  useEffect(() => {
    async function loadWinners() {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(
          process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
          abi,
          provider
        )
        const events = await contract.queryFilter(contract.filters.Draw1(), 0, 'latest')
        const last5 = events
          .slice(-5)
          .reverse()
          .map(e => ({
            roundId: e.args.id.toNumber(),
            winner: e.args.winner,
          }))
        setRecentWinners(last5)
      } catch (err) {
        console.error('Failed to load winners', err)
      }
    }
    loadWinners()
  }, [])

  async function handleUnifiedSubmit() {
    try {
      setBusy(true)
      setStatus('')

      const modal = new ethers.BrowserProvider(window.ethereum)
      const signer = await modal.getSigner()
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
        setDeadline(info.sd.toNumber())
        localStorage.setItem(`madfill-roundname-${newId}`, roundName || '')
        // setShowConfetti(true)
        // setTimeout(() => setShowConfetti(false), 5000)
      }

      // 2) Prompt user for word + fee
      const userWord = window.prompt(
        `Enter your word for blank #${blankIndex} (cost: ${ENTRY_FEE} BASE)`
      )
      if (!userWord) {
        setStatus('❌ Submission cancelled.')
        return
      }

      setStatus('⏳ Submitting entry…')
      const data = ethers.encodeBytes32String(userWord)
      const tx2 = await ct.submitPaid(
        BigInt(newId),
        Number(blankIndex),
        data,
        { value: ethers.parseEther(ENTRY_FEE) }
      )
      await tx2.wait()

      setStatus(`✅ Round ${newId} entry submitted!`)
      const preview = tpl.parts
        .map((part, i) =>
          i < tpl.blanks
            ? `${part}${i === Number(blankIndex) ? userWord : '____'}`
            : part
        )
        .join('')
      setShareText(encodeURIComponent(
        `I just entered a hilarious on-chain word game! 🧠\n\n${preview}\n\nPlay here: https://madfill.vercel.app`
      ))
    } catch (e) {
      const msg = (e.message || '').toLowerCase()
      if (msg.includes('denied')) {
        setStatus('❌ Transaction cancelled by you.')
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

  const blankStyle = (active) =>
    `inline-block w-8 text-center border-b-2 ${
      active ? 'border-white' : 'border-slate-400'
    } cursor-pointer mx-1`

  return (
    <ErrorBoundary>
      <Layout>
        <Head><title>MadFill</title></Head>

        {/* Fee breakdown banner */}
        <Card className="bg-slate-700 text-white rounded p-4 mb-6">
          <p><strong>Fees:</strong></p>
          <ul className="list-disc list-inside text-sm">
            <li>Create round → gas only</li>
            <li>Enter pool → <strong>{ENTRY_FEE} BASE</strong> per entry</li>
          </ul>
        </Card>

        {/* {showConfetti && <Confetti width={width} height={height} />} */}

        <main className="max-w-3xl mx-auto p-6 space-y-8">
          {/* Info Card */}
          {/* <motion.div>…</motion.div> */}
          <Card className="bg-gradient-to-tr from-purple-800 to-indigo-900 text-white shadow-2xl rounded-xl">
            <CardHeader>
              <h2 className="text-xl font-bold">🎮 What Is MadFill?</h2>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                MadFill is an on-chain word game where you create hilarious
                sentence mashups by filling in blanks on funny templates.
              </p>
              <p>
                Create a round (gas only), then enter with{' '}
                <strong>{ENTRY_FEE} BASE</strong>. Winner takes the pool.
              </p>
            </CardContent>
          </Card>

          {/* Round Setup */}
          <Card className="bg-gradient-to-br from-slate-800 to-indigo-800 text-white shadow-xl rounded-xl">
            <CardHeader className="flex items-center gap-2">
              <h2 className="text-xl font-bold">Start a New Round</h2>
              <Tooltip text="0.5% fees | Winner claims prize | All on-chain!" />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category / Template / Duration */}
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  ['Category', catIdx, setCatIdx, categories.map((c, i) => ({ label: c.name, value: i }))],
                  ['Template', tplIdx, setTplIdx, selectedCategory.templates?.map((t, i) => ({ label: t.name, value: i })) || []],
                  ['Duration', duration, setDuration, durations],
                ].map(([label, val, setter, opts]) => (
                  <div key={label}>
                    <label>{label}</label>
                    <select
                      className="w-full mt-1 bg-slate-900 text-white border rounded px-2 py-1"
                      value={val}
                      onChange={e => setter(+e.target.value)}
                      disabled={busy}
                    >
                      {opts.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <input
                type="text"
                maxLength={10}
                placeholder="Card Name"
                className="block w-full mt-2 bg-slate-900 text-white border rounded px-2 py-1"
                value={roundName}
                onChange={e => setRoundName(e.target.value)}
                disabled={busy}
              />

              <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm">
                {tpl.parts.map((part, i) => (
                  <Fragment key={i}>
                    <span>{part}</span>
                    {i < tpl.blanks && (
                      <span
                        className={blankStyle(i === +blankIndex)}
                        onClick={() => setBlankIndex(String(i))}
                      >
                        {i}
                      </span>
                    )}
                  </Fragment>
                ))}
              </div>

              <p className="text-sm">
                Selected Blank: <strong>{blankIndex}</strong>
              </p>

              <Button
                onClick={handleUnifiedSubmit}
                disabled={busy}
                className="bg-indigo-600 hover:bg-indigo-500 w-full"
              >
                {!roundId ? '🚀 Create Round' : '🪪 Enter Pool'}
              </Button>

              {status && <p className="text-sm mt-2">{status}</p>}

              {roundId && shareText && (
                <div className="mt-4 space-y-2">
                  <p className="font-semibold text-white">📣 Share your round:</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`https://twitter.com/intent/tweet?text=${shareText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
                    >
                      🐦 Twitter
                    </a>
                    <a
                      href={`https://warpcast.com/~/compose?text=${shareText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded"
                    >
                      🌀 Farcaster
                    </a>
                    <Link
                      href={`/round/${roundId}`}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded"
                    >
                      📜 View Round
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Winners */}
          <Card className="bg-gradient-to-br from-slate-800 to-indigo-800 text-white shadow-xl rounded-xl">
            <CardHeader>
              <h2 className="text-xl font-bold">🎉 Recent Winners</h2>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {recentWinners.length === 0 ? (
                <p>No winners yet.</p>
              ) : (
                recentWinners.map((w, i) => {
                  const nm =
                    localStorage.getItem(`madfill-roundname-${w.roundId}`) ||
                    `Round #${w.roundId}`
                  return (
                    <p key={i}>
                      <strong>{nm}</strong> → <code>{w.winner}</code>
                    </p>
                  )
                })
              )}
            </CardContent>
          </Card>
        </main>
      </Layout>
    </ErrorBoundary>
  )
}
