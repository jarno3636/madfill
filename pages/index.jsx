// pages/index.jsx
import React, { Component, useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { categories, durations } from '../data/templates'
import Layout from '@/components/Layout'
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
          `I just entered MadFill!\n\n${preview}\n\nPlay: https://madfill.vercel.app`
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

        {/* Fee breakdown */}
        <Card className="bg-slate-700 text-white rounded p-4 mb-6">
          <p>
            <strong>Fees:</strong>
          </p>
          <ul className="list-disc list-inside text-sm">
            <li>Create round → gas only</li>
            <li>Enter pool → <strong>{ENTRY_FEE} BASE</strong> per entry</li>
          </ul>
        </Card>

        <main className="max-w-3xl mx-auto p-6 space-y-8">
          {/* Info */}
          <Card className="bg-purple-800 text-white shadow-2xl rounded-xl">
            <CardHeader>
              <h2 className="text-xl font-bold">🎮 What Is MadFill?</h2>
            </CardHeader>
            <CardContent className="text-sm">
              Create a round (gas only), then enter it by paying{' '}
              <strong>{ENTRY_FEE} BASE</strong>. Winner takes the pool!
            </CardContent>
          </Card>

          {/* Setup */}
          <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
            <CardHeader className="flex items-center gap-2">
              <h2 className="text-xl font-bold">
                {!roundId ? 'Start a New Round' : `Round #${roundId}`}
              </h2>
              <Tooltip text="0.5% cut each way" />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category / Template / Duration */}
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  ['Category', catIdx, setCatIdx, categories],
                  ['Template', tplIdx, setTplIdx, selectedCategory.templates],
                  ['Duration', duration, setDuration, durations]
                ].map(([lbl, val, fn, opts]) => (
                  <div key={lbl}>
                    <label>{lbl}</label>
                    <select
                      className="w-full mt-1 bg-slate-900 text-white border rounded px-2 py-1"
                      value={val}
                      onChange={e => fn(+e.target.value)}
                      disabled={busy}
                    >
                      {opts.map((o, i) => (
                        <option key={i} value={o.value ?? i}>
                          {o.label ?? o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Card name */}
              <input
                type="text"
                maxLength={10}
                placeholder="Card Name"
                className="w-full bg-slate-900 text-white border rounded px-2 py-1"
                value={roundName}
                onChange={e => setRoundName(e.target.value)}
                disabled={busy}
              />

              {/* Template preview */}
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

              {/* Word input */}
              <input
                type="text"
                placeholder="Your Word"
                value={word}
                onChange={e => setWord(e.target.value)}
                className="w-full bg-slate-900 text-white border rounded px-2 py-1"
                disabled={busy}
              />

              {/* Create / Enter */}
              <Button
                onClick={handleUnifiedSubmit}
                disabled={busy || !word}
                className="bg-indigo-600 hover:bg-indigo-500 w-full"
              >
                {!roundId ? '🚀 Create Round' : '🪪 Enter Pool'}
              </Button>

              {/* Status */}
              {status && <p className="text-sm mt-2">{status}</p>}

              {/* Sharing */}
              {roundId && shareText && (
                <div className="mt-4 space-y-2">
                  <p className="font-semibold">📣 Share:</p>
                  <div className="flex gap-2">
                    <a
                      href={`https://twitter.com/intent/tweet?text=${shareText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 px-4 py-2 rounded"
                    >
                      🐦 Twitter
                    </a>
                    <a
                      href={`https://warpcast.com/~/compose?text=${shareText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-purple-600 px-4 py-2 rounded"
                    >
                      🌀 Farcaster
                    </a>
                    <Link href={`/round/${roundId}`}>
                      <a className="bg-slate-700 px-4 py-2 rounded">📜 View</a>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Winners */}
          <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
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
