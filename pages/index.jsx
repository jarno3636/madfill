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

// --- ErrorBoundary to catch render errors ---
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
          <h2 className="text-2xl font-bold text-red-600">Oops! Something broke.</h2>
          <pre className="mt-4 p-4 bg-slate-100 text-sm text-red-800 rounded">
            {this.state.error?.toString()}
          </pre>
          <Button onClick={() => window.location.reload()}>Reload</Button>
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

  // fetch deadline when roundId changes
  useEffect(() => {
    if (!roundId) return setDeadline(null)
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
    ct.rounds(BigInt(roundId))
      .then(info => setDeadline(info.sd))
      .catch(() => setDeadline(null))
  }, [roundId])

  // fetch recent winners
  useEffect(() => {
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const evs = await ct.queryFilter(ct.filters.Draw1(), 0, 'latest')
        setRecentWinners(
          evs.slice(-5).reverse().map(e => ({ roundId: e.args.id.toNumber(), winner: e.args.winner }))
        )
      } catch (err) {
        console.error('Failed to load winners', err)
      }
    })()
  }, [])

  async function handleUnifiedSubmit() {
    if (!word) {
      setStatus('❌ Please enter a word to join the pool.')
      return
    }
    try {
      setBusy(true)
      setStatus('')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      let newId = roundId

      // Start round (gas only)
      if (!roundId) {
        setStatus('⏳ Creating round…')
        const tx = await ct.start(tpl.blanks, ethers.parseEther(ENTRY_FEE), BigInt(duration * 86400))
        await tx.wait()
        const ev = await ct.queryFilter(ct.filters.Started(), 0, 'latest')
        newId = ev[ev.length - 1].args.id.toString()
        setRoundId(newId)
        const info = await ct.rounds(BigInt(newId))
        setDeadline(info.sd)
        localStorage.setItem(`madfill-roundname-${newId}`, roundName || '')
      }

      // Submit entry
      setStatus('⏳ Submitting entry…')
      const data = ethers.encodeBytes32String(word)
      const tx2 = await ct.submitPaid(BigInt(newId), Number(blankIndex), data, { value: ethers.parseEther(ENTRY_FEE) })
      await tx2.wait()
      setStatus(`✅ Entry for Round #${newId} submitted!`)

      const preview = tpl.parts.map((p,i) => i < tpl.blanks
        ? `${p}${i===Number(blankIndex)?word:'____'}`
        : p
      ).join('')
      setShareText(encodeURIComponent(`I just joined Round #${newId} on MadFill! \n\n${preview}\n\nCheck it out: https://madfill.vercel.app`))
    } catch (e) {
      const msg = (e?.message||'').toLowerCase()
      if (msg.includes('denied')) setStatus('❌ Tx cancelled.')
      else if (msg.includes('execution reverted')||msg.includes('require(false)')) setStatus('❌ On-chain failure.')
      else setStatus('❌ ' + (e.message||'Unknown error'))
    } finally { setBusy(false) }
  }

  const blankStyle = active =>
    `inline-block w-8 text-center border-b-2 ${active?'border-white':'border-slate-400'} cursor-pointer mx-1`

  return (
    <ErrorBoundary>
      <Layout>
        <Head><title>MadFill · Home</title></Head>

        {/* Fun Intro */}
        <section className="max-w-3xl mx-auto p-6">
          <h1 className="text-4xl font-extrabold">Welcome to MadFill 🎉</h1>
          <p className="mt-4 text-lg text-gray-700">
            Dive into the world’s quirkiest on-chain word mashups! <br/>
            Pick a template, fill in the blanks, and watch the hilarity unfold.<br/>
            Create your own round or challenge others to top your entry. <br/>
            All powered by Base (no surprises—just pure fun!).
          </p>
        </section>

        {/* Fee Structure */}
        <Card className="max-w-3xl mx-auto bg-yellow-100 text-yellow-900 rounded p-6 mb-8">
          <h2 className="text-2xl font-bold mb-2">💰 Fee Breakdown</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Create a round:</strong> Gas only (no token fee)</li>
            <li><strong>Enter a round:</strong> {ENTRY_FEE} BASE per entry</li>
            <li><em>0.5% pool cut on entry & claim each</em>—supports the platform!</li>
          </ul>
        </Card>

        <main className="max-w-3xl mx-auto p-6 space-y-8">
          {/* Setup Card */}
          <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {!roundId ? '🚀 Start a New Round' : `🕹️ Round #${roundId}`}
              </h2>
              <Tooltip text="0.5% cut each way" />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* selectors & inputs */}
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  ['Category', catIdx, setCatIdx, categories],
                  ['Template', tplIdx, setTplIdx, selectedCategory.templates],
                  ['Duration', duration, setDuration, durations]
                ].map(([lbl,val,fn,opts]) => (
                  <div key={lbl}>
                    <label className="font-medium">{lbl}</label>
                    <select
                      className="w-full mt-1 bg-slate-900 text-white rounded px-2 py-1"
                      value={val}
                      onChange={e=>fn(+e.target.value)}
                      disabled={busy}
                    >
                      {opts.map((o,i)=>(<option key={i} value={o.value??i}>{o.label||o.name}</option>))}
                    </select>
                  </div>
                ))}
              </div>

              {/* name + word */}
              <input
                type="text" maxLength={10} placeholder="Card Name"
                className="block w-full bg-slate-900 text-white rounded px-2 py-1"
                value={roundName} onChange={e=>setRoundName(e.target.value)} disabled={busy}
              />
              <input
                type="text" placeholder="Your Word"
                className="block w-full bg-slate-900 text-white rounded px-2 py-1"
                value={word} onChange={e=>setWord(e.target.value)} disabled={busy}
              />

              {/* preview */}
              <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm">
                {tpl.parts.map((part,i)=>(<Fragment key={i}>
                  <span>{part}</span>
                  {i<tpl.blanks && <span className={blankStyle(i===+blankIndex)} onClick={()=>setBlankIndex(String(i))}>{i}</span>}
                </Fragment>))}
              </div>

              <p className="text-sm">Selected Blank: <strong>{blankIndex}</strong></p>

              {/* submit */}
              <Button
                onClick={handleUnifiedSubmit}
                disabled={busy||!word}
                className="w-full bg-indigo-600 hover:bg-indigo-500"
              >
                {!roundId ? 'Start Round' : 'Enter Pool'}
              </Button>
              {status && <p className="text-sm mt-2">{status}</p>}
            </CardContent>
          </Card>

          {/* Recent Winners */}
          <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
            <CardHeader><h2 className="text-xl font-bold">🎉 Recent Winners</h2></CardHeader>
            <CardContent className="text-sm space-y-1">
              {recentWinners.length===0
                ? <p>No winners yet.</p>
                : recentWinners.map((w,i)=>(<p key={i}><strong>{localStorage.getItem(`madfill-roundname-${w.roundId}`)||`Round #${w.roundId}`}</strong> → <code>{w.winner}</code></p>))}
            </CardContent>
          </Card>

          {/* Active Rounds - placeholder */}
          <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
            <CardHeader><h2 className="text-xl font-bold">⏳ Active Rounds</h2></CardHeader>
            <CardContent className="text-sm">
              {/* TODO: load and display active rounds */}
              <p>Coming soon—stay tuned for live games!</p>
            </CardContent>
          </Card>

          {/* My Rounds - placeholder */}
          <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
            <CardHeader><h2 className="text-xl font-bold">📋 My Rounds & Entries</h2></CardHeader>
            <CardContent className="text-sm">
              {/* TODO: load user’s created rounds & entries */}
              <p>No rounds or entries found.</p>
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="mt-12 py-6 bg-slate-900 text-center text-gray-400 text-sm">
          Made with ❤️ on Base • <a href="https://github.com/jarno3636/madfill" className="underline">Source</a>
        </footer>
      </Layout>
    </ErrorBoundary>
  )
}
