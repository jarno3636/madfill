import { useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { categories } from '../data/templates'
import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
import { Tooltip } from '@/components/ui/tooltip'
import Link from 'next/link'

export default function Home() {
  const [status, setStatus] = useState('')
  const [roundId, setRoundId] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [roundName, setRoundName] = useState('')
  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(1)
  const [showConfetti, setShowConfetti] = useState(false)
  const [deadline, setDeadline] = useState(null)
  const [recentWinners, setRecentWinners] = useState([])
  const [shareText, setShareText] = useState('')
  const { width, height } = useWindowSize()
  const ENTRY_FEE = '0.001'

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]
  const [busy, setBusy] = useState(false)

  const durations = [
    { label: '1 Day', value: 1 }, { label: '2 Days', value: 2 },
    { label: '3 Days', value: 3 }, { label: '4 Days', value: 4 },
    { label: '5 Days', value: 5 }, { label: '6 Days', value: 6 },
    { label: '1 Week', value: 7 },
  ]

  useEffect(() => {
    if (!roundId) return setDeadline(null)
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
    contract.rounds(BigInt(roundId)).then(info => {
      setDeadline(info.sd.toNumber())
    }).catch(() => setDeadline(null))
  }, [roundId])

  useEffect(() => {
    const loadWinners = async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const events = await contract.queryFilter(contract.filters.Draw1(), 0, 'latest')
        const last5 = events.slice(-5).reverse().map(e => ({
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
      const modal = new ethers.BrowserProvider(window.ethereum)
      const signer = await modal.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      setBusy(true)
      setStatus('')
      let newId = roundId

      if (!roundId) {
        setStatus('⏳ Creating round…')
        const tx = await ct.start(tpl.blanks, ethers.parseEther(ENTRY_FEE), BigInt(duration * 86400))
        await tx.wait()
        const events = await ct.queryFilter(ct.filters.Started(), 0, 'latest')
        newId = events[events.length - 1].args.id.toString()
        setRoundId(newId)
        const info = await ct.rounds(BigInt(newId))
        setDeadline(info.sd.toNumber())
        localStorage.setItem(`madfill-roundname-${newId}`, roundName || '')
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 5000)
      }

      setStatus('⏳ Submitting entry…')
      const data = ethers.encodeBytes32String(word)
      const tx2 = await ct.submitPaid(BigInt(newId), Number(blankIndex), data, {
        value: ethers.parseEther(ENTRY_FEE),
      })
      await tx2.wait()
      setStatus(`✅ Round ${newId} entry submitted!`)

      const preview = tpl.parts.map((part, i) =>
        i < tpl.blanks ? `${part}${i === Number(blankIndex) ? word : '____'}` : part
      ).join('')
      const share = encodeURIComponent(`I just entered a hilarious on-chain word game! 🧠\n\n${preview}\n\nPlay here: https://madfill.vercel.app`)
      setShareText(share)
    } catch (e) {
      setStatus('❌ ' + (e.message || 'Unknown error'))
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = (active) =>
    `inline-block w-8 text-center border-b-2 ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  return (
    <Layout>
      <Head><title>MadFill</title></Head>
      {showConfetti && <Confetti width={width} height={height} />}
      <main className="max-w-3xl mx-auto p-6 space-y-8">

        {/* Info Section */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <Card className="bg-gradient-to-tr from-purple-800 to-indigo-900 text-white shadow-2xl rounded-xl">
            <CardHeader><h2 className="text-xl font-bold">🎮 What Is MadFill?</h2></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>MadFill is an on-chain word game where you create hilarious sentence mashups by filling in blanks on funny templates.</p>
              <p>Each round costs <strong>{ENTRY_FEE} BASE</strong> to create and play. Winner takes the pool!</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Round Setup */}
        <Card className="bg-gradient-to-br from-slate-800 to-indigo-800 text-white shadow-xl rounded-xl">
          <CardHeader className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Start a New Round</h2>
            <Tooltip text="0.5% fees | Winner claims prize | All on-chain!" />
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Selectors */}
            <div className="grid md:grid-cols-3 gap-4">
              {[['Category', catIdx, setCatIdx, categories.map((c, i) => ({ label: c.name, value: i }))],
                ['Template', tplIdx, setTplIdx, selectedCategory.templates.map((t, i) => ({ label: t.name, value: i }))],
                ['Duration', duration, setDuration, durations]
              ].map(([label, val, setVal, opts]) => (
                <div key={label}>
                  <label>{label}</label>
                  <select className="w-full mt-1 bg-slate-900 text-white border rounded px-2 py-1"
                    value={val} onChange={e => setVal(+e.target.value)} disabled={busy}>
                    {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <input type="text" maxLength={10} placeholder="Card Name"
              className="block w-full mt-2 bg-slate-900 text-white border rounded px-2 py-1"
              value={roundName} onChange={e => setRoundName(e.target.value)} disabled={busy}
            />

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

            <p className="text-sm">Selected Blank: <strong>{blankIndex}</strong></p>
            <input type="text" placeholder="Your Word" value={word} onChange={e => setWord(e.target.value)}
              className="w-full bg-slate-900 text-white border rounded px-2 py-1" disabled={busy} />

            {deadline && <p className="text-sm">⏱️ Submissions close in: <Countdown targetTimestamp={deadline} /></p>}

            <Button onClick={handleUnifiedSubmit} disabled={!word || busy} className="bg-indigo-600 hover:bg-indigo-500">
              {!roundId ? '🚀 Create & Submit' : '✏️ Submit Entry'}
            </Button>

            {status && <p className="text-sm mt-2">{status}</p>}

            {roundId && shareText && (
              <div className="mt-4 space-y-2">
                <p className="font-semibold text-white">📣 Share your round:</p>
                <div className="flex flex-wrap gap-2">
                  <a href={`https://twitter.com/intent/tweet?text=${shareText}`} target="_blank" rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">🐦 Twitter</a>
                  <a href={`https://warpcast.com/~/compose?text=${shareText}`} target="_blank" rel="noopener noreferrer"
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded">🌀 Farcaster</a>
                  <Link href={`/round/${roundId}`} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded">📜 View Round</Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Winners */}
        <Card className="bg-gradient-to-br from-slate-800 to-indigo-800 text-white shadow-xl rounded-xl">
          <CardHeader><h2 className="text-xl font-bold">🎉 Recent Winners</h2></CardHeader>
          <CardContent className="text-sm space-y-1">
            {recentWinners.length === 0
              ? <p>No winners yet.</p>
              : recentWinners.map((w, i) => {
                  const name = localStorage.getItem(`madfill-roundname-${w.roundId}`) || `Round #${w.roundId}`
                  return <p key={i}><strong>{name}</strong> → <code>{w.winner}</code></p>
                })}
          </CardContent>
        </Card>
      </main>
    </Layout>
  )
}
