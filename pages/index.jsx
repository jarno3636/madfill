// pages/index.jsx
import React, { useState, useEffect, Fragment, useRef } from 'react'
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
    const cleanedParts = tpl.parts.map(p => p.trim())

    if (!word || word.length > 32) {
      setStatus('❌ Word must be 1–32 characters long.')
      log('Invalid word input')
      return
    }

    if (feeUsd < 0.25) {
      setStatus('❌ Entry fee must be at least $0.25')
      log('Fee too low')
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

      const feeInBase = await ct.usdToBase(ethers.parseUnits(feeUsd.toString(), 18))
      let newId = roundId

      if (!roundId) {
        log(`🚀 Creating round "${roundName || 'Untitled'}" with ${tpl.blanks} blanks…`)
        const tx = await ct.createPool1(
          roundName || 'Untitled',
          cleanedParts,
          word,
          profile?.username || 'anon',
          ethers.parseUnits(feeUsd.toString(), 18),
          duration * 86400,
          { value: feeInBase }
        )
        log('📡 Waiting for tx confirmation…')
        const receipt = await tx.wait()
        const creationEvent = receipt.logs.find(log => log.fragment?.name === 'Pool1Created')
        if (creationEvent) {
          newId = creationEvent.args.id.toString()
          setRoundId(newId)
          localStorage.setItem(`madfill-roundname-${newId}`, roundName)
          log(`✅ Round ${newId} created.`)
        }
      } else {
        log(`✍️ Joining Round #${roundId}…`)
        const tx = await ct.joinPool1(
          roundId,
          word,
          profile?.username || 'anon',
          { value: feeInBase }
        )
        await tx.wait()
        log(`✅ Joined Round ${roundId}`)
      }

      const preview = cleanedParts.map((p, i) => i < tpl.blanks ? `${p}${i === +blankIndex ? word : '____'}` : p).join('')
      setShareText(encodeURIComponent(`I just entered MadFill Round #${newId} 💥\n\n${preview}\n\nPlay: https://madfill.vercel.app`))
      setStatus(`✅ Submitted to Round ${newId}`)
    } catch (err) {
      console.error(err)
      setStatus(`❌ ${err?.message?.split('(')[0] || 'Failed'}`)
      log(`❌ ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active =>
    `inline-block w-16 text-center border-b-2 font-bold text-lg ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  const renderTemplatePreview = () => (
    <p className="text-base bg-slate-700 p-4 rounded-xl leading-relaxed shadow-md border border-indigo-400">
      📄 {tpl.parts.map((p, i) => (
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
      <Head><title>MadFill</title></Head>
      {shareText && <Confetti width={width} height={height} />}

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <Card className="bg-purple-800 text-white rounded p-6">
          <h3 className="text-xl font-bold mb-2">🧠 MadFill: Fill the blanks. Win the prize.</h3>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Pick a prompt, enter with a word.</li>
            <li>At deadline, a random winner gets the pot.</li>
          </ul>
          {profile && (
            <p className="mt-2 text-yellow-300 text-sm">🎉 Welcome @{profile.username}</p>
          )}
          {totalRounds !== null && (
            <p className="text-xs text-pink-200 mt-2">🔥 {totalRounds} rounds created</p>
          )}
        </Card>

        <Card className="bg-slate-800 text-white">
          <CardHeader className="flex flex-col sm:flex-row justify-between">
            <h2 className="text-xl font-bold">{roundId ? `🔁 Round #${roundId}` : '🚀 Create Round & Submit'}</h2>
            <Tooltip text="0.5% platform fee" />
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
                <label className="text-sm">💵 Entry Fee (USD)</label>
                <input
                  type="range"
                  min="0.25"
                  max="10"
                  step="0.25"
                  value={feeUsd}
                  onChange={e => setFeeUsd(Number(e.target.value))}
                  disabled={busy}
                  className="w-full"
                />
                <p className="text-sm mt-1">${feeUsd.toFixed(2)}</p>
              </div>
            </div>

            <Button onClick={handleUnifiedSubmit} disabled={busy} className="bg-indigo-600 hover:bg-indigo-500">
              {roundId ? 'Join Round' : 'Create Round & Submit'}
            </Button>

            <div className="text-green-200 text-xs mt-4 max-h-40 overflow-y-auto p-2 bg-black/40 border border-green-400 rounded" ref={loggerRef}>
              {logs.map((msg, i) => <div key={i}>→ {msg}</div>)}
            </div>
          </CardContent>
        </Card>

        <Footer />
      </main>
    </Layout>
  )
}
