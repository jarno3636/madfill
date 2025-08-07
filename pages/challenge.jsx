// pages/challenge.jsx
import { useEffect, useState, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryV3_ABI.json'
import { categories, durations } from '@/data/templates'
import Link from 'next/link'
import { fetchFarcasterProfile } from '@/lib/neynar'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import { useRouter } from 'next/router'

export default function ChallengePage() {
  const [roundId, setRoundId] = useState('')
  const [originalWord, setOriginalWord] = useState('')
  const [originalPreview, setOriginalPreview] = useState('')
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [blankIndex, setBlankIndex] = useState('0')
  const [word, setWord] = useState('')
  const [feeUsd, setFeeUsd] = useState(1.0)
  const [duration, setDuration] = useState(durations[0].value)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [profile, setProfile] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const { width, height } = useWindowSize()
  const router = useRouter()

  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

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

  useEffect(() => {
    if (!roundId) return setOriginalPreview('')
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const info = await ct.getPool1Info(roundId)
        const creator = info[5]
        const sub = await ct.getPool1Submission(roundId, creator)
        const word = sub[1]
        setOriginalWord(word)

        const preview = tpl.parts.map((part, i) =>
          i === +blankIndex ? part + word : i < tpl.blanks ? part + '____' : part
        ).join('')

        setOriginalPreview(preview)
      } catch (err) {
        console.warn('Failed to load original submission:', err)
        setOriginalPreview('❌ Couldn’t fetch original submission.')
      }
    })()
  }, [roundId, tpl, blankIndex])

  async function handleSubmit() {
    if (!roundId || !word) return setStatus('❌ Please fill in all fields.')
    if (!window.ethereum) return setStatus('❌ No wallet detected')

    try {
      setBusy(true)
      setStatus('⏳ Submitting your challenger card…')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      const baseAmount = await ct.usdToBase(ethers.parseUnits(feeUsd.toString(), 6))
      const buffer = baseAmount * 1005n / 1000n

      const tx = await ct.createPool2(
        roundId,
        word,
        profile?.username || 'anon',
        baseAmount,
        duration * 86400,
        { value: buffer }
      )
      await tx.wait()

      setStatus(`✅ Challenger submitted to Round #${roundId}`)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
      setTimeout(() => router.push('/vote'), 3000)
    } catch (err) {
      console.error(err)
      const msg = err?.message?.split('(')[0]?.trim() || 'Submission failed'
      setStatus(`❌ ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active =>
    `inline-block w-8 text-center border-b-2 font-bold ${active ? 'border-yellow-300 text-yellow-200' : 'border-slate-400'} cursor-pointer mx-1`

  const renderCard = (fillWord) => (
    <div className="p-4 bg-slate-800 border border-indigo-400 rounded-xl shadow-md text-sm leading-relaxed">
      {tpl.parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < tpl.blanks && (
            <span className={blankStyle(i === +blankIndex)}>
              {i === +blankIndex ? (fillWord || '____') : '____'}
            </span>
          )}
        </Fragment>
      ))}
    </div>
  )

  const shareText = encodeURIComponent(`I just submitted a challenger card for Round #${roundId}! 😂\nVote here: https://madfill.vercel.app/vote`)

  return (
    <Layout>
      <Head><title>Submit a Challenger | MadFill</title></Head>
      {showConfetti && <Confetti width={width} height={height} />} 
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 text-white px-4 py-6">
        <h1 className="text-3xl font-bold mb-4">😆 Submit a Challenger Card</h1>

        <Card className="bg-gradient-to-tr from-purple-800 to-indigo-900 text-white shadow-xl mb-6">
          <CardHeader><h2 className="text-xl font-bold">How It Works</h2></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Think you can out-funny the original? Submit your word and challenge the crowd!</p>
            <p>After submissions close, the community votes between the Original & Challenger to pick a winner.</p>
            <p className="text-yellow-300">💡 Spread the word and get your friends to vote for your challenger!</p>
            <p className="text-xs mt-1">
              Want to vote instead?{' '}
              <Link href="/vote" className="underline text-indigo-300">Go to Community Vote</Link>
            </p>
            {profile && (
              <div className="mt-3 flex items-center gap-2">
                <img src={profile.pfp_url} alt="Avatar" className="w-6 h-6 rounded-full border border-white" />
                <span className="text-xs text-yellow-200">Hi @{profile.username}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white shadow-lg mb-8">
          <CardHeader><h2 className="text-lg font-semibold">Challenger Card Form</h2></CardHeader>
          <CardContent className="space-y-4">

            {/* Round ID */}
            <div>
              <label>Round ID</label>
              <input type="text" className="block w-full bg-slate-800 border rounded px-2 py-1 mt-1" value={roundId} onChange={e => setRoundId(e.target.value)} />
            </div>

            {/* Card Preview */}
            {originalPreview && (
              <div className="grid md:grid-cols-2 gap-4 items-start mt-4">
                <div>
                  <h3 className="text-sm font-semibold mb-1">🧾 Original Card</h3>
                  {renderCard(originalWord)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">⚔️ Your Challenger Card</h3>
                  {renderCard(word)}
                </div>
              </div>
            )}

            {/* Category + Template */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label>📚 Category</label>
                <select className="block w-full mt-1 bg-slate-800 border rounded px-2 py-1" value={catIdx} onChange={e => setCatIdx(+e.target.value)}>
                  {categories.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>📝 Template</label>
                <select className="block w-full mt-1 bg-slate-800 border rounded px-2 py-1" value={tplIdx} onChange={e => setTplIdx(+e.target.value)}>
                  {selectedCategory.templates.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* Pick Blank */}
            <div>
              <label>🎯 Pick Blank</label>
              <div className="bg-slate-800 border border-slate-700 rounded p-4 font-mono text-sm">
                {tpl.parts.map((part, i) => (
                  <Fragment key={i}>
                    <span>{part}</span>
                    {i < tpl.blanks && (
                      <span className={blankStyle(i === +blankIndex)} onClick={() => setBlankIndex(String(i))}>{i}</span>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Word input */}
            <div>
              <label>🧠 Your Word</label>
              <input type="text" className="block w-full mt-1 bg-slate-800 border rounded px-2 py-1" value={word} onChange={e => setWord(e.target.value)} />
            </div>

            {/* Duration + Fee */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label>🕓 Duration</label>
                <select className="w-full mt-1 bg-slate-800 border rounded px-2 py-1" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                  {durations.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label>💰 Entry Fee (USD)</label>
                <input
                  type="range"
                  min="0.25"
                  max="10"
                  step="0.25"
                  value={feeUsd}
                  onChange={e => setFeeUsd(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm mt-1">${feeUsd.toFixed(2)}</p>
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={busy || !roundId || !word} className="bg-blue-600 hover:bg-blue-500 w-full">
              🚀 Submit Challenger Card
            </Button>

            {status && <p className="text-sm mt-2">{status}</p>}

            {status.includes('✅') && (
              <div className="text-sm mt-4">
                Share your card:
                <a
                  href={`https://twitter.com/intent/tweet?text=${shareText}`}
                  target="_blank"
                  className="ml-2 underline text-blue-400"
                >🐦 Twitter</a>
                <span className="mx-2">|</span>
                <a
                  href={`https://warpcast.com/~/compose?text=${shareText}`}
                  target="_blank"
                  className="underline text-purple-400"
                >🌀 Warpcast</a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
