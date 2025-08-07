import React, { useState, useEffect, Fragment, useRef } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryV3_ABI.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { categories, durations } from '../data/templates'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import { fetchFarcasterProfile } from '@/lib/neynar'

export default function Home() {
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState([])
  const loggerRef = useRef(null)
  const [roundId, setRoundId] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [roundName, setRoundName] = useState('')
  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(durations[0].value)
  const [feeBase, setFeeBase] = useState(0.01)
  const [shareText, setShareText] = useState('')
  const [busy, setBusy] = useState(false)
  const { width, height } = useWindowSize()
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
    async function loadProfile() {
      const fid = localStorage.getItem('fc_fid')
      if (fid) {
        const p = await fetchFarcasterProfile(fid)
        setProfile(p)
      }
    }
    loadProfile()
  }, [])

  async function handleUnifiedSubmit() {
    const cleanedParts = tpl.parts.map(p => p.trim())

    if (!word || word.length > 32) {
      setStatus('❌ Word must be 1–32 characters long.')
      log('Invalid word input')
      return
    }

    if (cleanedParts.length !== tpl.blanks + 1) {
      setStatus('❌ Template error: Number of parts must equal blanks + 1')
      log('Template mismatch')
      return
    }

    try {
      setBusy(true)
      setStatus('')
      log('🔍 Connecting to wallet…')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      const baseAmount = ethers.parseEther(feeBase.toString())
      const buffer = baseAmount * 1005n / 1000n

      log(`🚀 Creating round "${roundName || 'Untitled'}"…`)
      const tx = await ct.createPool1(
        roundName || 'Untitled',
        selectedCategory.name,
        cleanedParts,
        word,
        profile?.username || 'anon',
        baseAmount,
        duration * 86400,
        { value: buffer }
      )
      const receipt = await tx.wait()
      const event = receipt.logs.find(log => log.fragment?.name === 'Pool1Created')
      if (event) {
        const id = event.args.id.toString()
        setRoundId(id)
        setShareText(`https://warpcast.com/~/compose?text=${encodeURIComponent(`Just created a new MadFill round! 🤯\n\nJoin Round #${id}: https://madfill.vercel.app/round/${id}`)}`)
        log(`✅ Round ${id} created.`)
      }
      setStatus('✅ Success!')
    } catch (err) {
      console.error(err)
      setStatus(`❌ ${err?.message?.split('(')[0] || 'Failed'}`)
      log(`❌ ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = (active) => `inline-block w-16 text-center border-b-2 font-bold text-lg ${active ? 'border-yellow-400 text-yellow-300' : 'border-slate-400'} cursor-pointer mx-1`

  const renderTemplatePreview = () => (
    <p className="text-base bg-slate-700 p-4 rounded-xl leading-relaxed shadow-md border border-indigo-400">
      🧾 {tpl.parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < tpl.blanks && (
            <span
              className={blankStyle(i === +blankIndex)}
              onClick={() => setBlankIndex(i.toString())}
            >
              {i === +blankIndex ? (word || '____') : '____'}
            </span>
          )}
        </Fragment>
      ))}
    </p>
  )

  return (
    <Layout>
      <Head><title>MadFill – Create or Join a Round</title></Head>
      {shareText && <Confetti width={width} height={height} />}
      <main className="max-w-5xl mx-auto p-6 space-y-6 text-white">

        <div className="bg-gradient-to-r from-indigo-600 to-purple-800 p-6 rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold mb-2">🧠 What is MadFill?</h1>
          <p className="text-sm text-indigo-100 leading-relaxed">
            MadFill is a decentralized game where you fill in the blanks of funny sentence templates with your own words. Compete in rounds, vote on the funniest submissions, and win prize pools paid out in BASE. Create your own rounds, challenge others, or vote to crown a winner. It's part MadLibs, part meme war, all fun.
          </p>
        </div>

        <Card className="bg-slate-800 text-white">
          <CardHeader>
            <h2 className="text-xl font-bold">🚀 Create a New Round</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {status && <div className="bg-slate-700 p-2 rounded text-sm">{status}</div>}

            <input
              type="text"
              maxLength={12}
              className="w-full bg-slate-900 text-white border px-2 py-1 rounded"
              placeholder="Round Name (optional)"
              value={roundName}
              onChange={e => setRoundName(e.target.value)}
              disabled={busy}
            />

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm">📚 Category</label>
                <select className="w-full bg-slate-900 text-white border px-2 py-1 rounded" value={catIdx} onChange={e => setCatIdx(+e.target.value)} disabled={busy}>
                  {categories.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-sm">📝 Template</label>
                <select className="w-full bg-slate-900 text-white border px-2 py-1 rounded" value={tplIdx} onChange={e => setTplIdx(+e.target.value)} disabled={busy}>
                  {selectedCategory.templates.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {renderTemplatePreview()}

            <input
              type="text"
              placeholder="Your word…"
              className="w-full bg-slate-900 text-white border px-2 py-1 rounded"
              value={word}
              onChange={e => setWord(e.target.value)}
              disabled={busy}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm">🕓 Duration (days)</label>
                <select
                  className="w-full bg-slate-900 text-white border px-2 py-1 rounded"
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  disabled={busy}
                >
                  {durations.map((d, i) => <option key={i} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">💰 Entry Fee (BASE)</label>
                <input
                  type="range"
                  min="0.001"
                  max="0.1"
                  step="0.001"
                  value={feeBase}
                  onChange={e => setFeeBase(Number(e.target.value))}
                  disabled={busy}
                  className="w-full"
                />
                <p className="text-sm mt-1">{feeBase.toFixed(3)} BASE</p>
              </div>
            </div>

            <Button onClick={handleUnifiedSubmit} disabled={busy} className="bg-indigo-600 hover:bg-indigo-500">
              Create Round & Submit
            </Button>

            {shareText && (
              <div className="mt-4">
                <a
                  href={shareText}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded text-white text-sm font-medium inline-block"
                >
                  📣 Share on Warpcast
                </a>
              </div>
            )}

            <div className="text-green-200 text-xs mt-4 max-h-40 overflow-y-auto p-2 bg-black/40 border border-green-400 rounded" ref={loggerRef}>
              {logs.map((msg, i) => <div key={i}>→ {msg}</div>)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border border-indigo-700 text-white">
          <CardHeader>
            <h2 className="text-xl font-bold">📊 MadFill Fee Breakdown</h2>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>💰 You choose the BASE amount for your round’s entry fee. This goes into the prize pool.</p>
            <p>📉 A small 0.5% protocol fee is automatically deducted to support the game.</p>
            <p>🔄 All remaining funds go directly into the round’s pool, which can be won or voted on later.</p>
            <p>🧾 No USD conversion or oracles needed. Simple, clean, BASE-only logic built into the contract.</p>
          </CardContent>
        </Card>

        <Footer />
      </main>
    </Layout>
  )
}
