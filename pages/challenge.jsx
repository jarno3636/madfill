// pages/challenge.jsx
import { useEffect, useState, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryV2_ABI.json'
import { categories } from '@/data/templates'
import Link from 'next/link'
import { fetchFarcasterProfile } from '@/lib/neynar'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'

export default function ChallengePage() {
  const [roundId, setRoundId] = useState('')
  const [originalPreview, setOriginalPreview] = useState('')
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [blankIndex, setBlankIndex] = useState('0')
  const [word, setWord] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [profile, setProfile] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const { width, height } = useWindowSize()

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
    if (!roundId) {
      setOriginalPreview('')
      return
    }

    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const subs = await ct.getPool1Submissions(BigInt(roundId))

        if (!subs.length) {
          setOriginalPreview('No original submission found yet.')
          return
        }

        const first = subs[0]
        const originalWord = ethers.decodeBytes32String(first.word)
        const originalBlank = Number(first.blankIndex)

        const preview = tpl.parts.map((p, i) => (
          i === originalBlank ? p + originalWord : i < tpl.blanks ? p + '____' : p
        )).join('')

        setOriginalPreview(preview)
      } catch (err) {
        console.warn('Failed to load original submission:', err)
        setOriginalPreview('❌ Couldn’t fetch original submission.')
      }
    })()
  }, [roundId, tpl])

  async function handleSubmit() {
    if (!roundId || !word) return setStatus('❌ Please fill in all fields.')
    if (!window.ethereum) return setStatus('❌ No web3 provider')

    try {
      setBusy(true)
      setStatus('⏳ Submitting your challenger card…')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      const encoded = ethers.encodeBytes32String(word)
      const tx = await ct.challenge1(BigInt(roundId), Number(blankIndex), encoded)
      await tx.wait()

      setStatus(`✅ Challenger submitted to round #${roundId}`)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
    } catch (err) {
      console.error(err)
      const message = err?.message?.split('(')[0]?.trim() || 'Submission failed'
      setStatus(`❌ ${message}`)
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active => `inline-block w-8 text-center border-b-2 ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  const shareText = encodeURIComponent(`I just submitted a challenger card for Round #${roundId}! 😂
Vote here: https://madfill.vercel.app/vote`)

  return (
    <Layout>
      <Head>
        <title>Submit a Challenger | MadFill</title>
      </Head>
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
            <div>
              <label>Round ID</label>
              <input type="text" className="block w-full bg-slate-800 border rounded px-2 py-1 mt-1" value={roundId} onChange={e => setRoundId(e.target.value)} />
            </div>

            {originalPreview && (
              <div className="bg-slate-800 border border-slate-700 rounded p-3 text-sm italic">
                📝 Original: {originalPreview}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[['Category', catIdx, setCatIdx, categories.map((c, i) => ({ label: c.name, value: i }))], ['Template', tplIdx, setTplIdx, selectedCategory.templates.map((t, i) => ({ label: t.name, value: i }))]].map(([lbl, val, fn, opts]) => (
                <div key={lbl}>
                  <label>{lbl}</label>
                  <select className="block w-full mt-1 bg-slate-800 border rounded px-2 py-1" value={val} onChange={e => fn(+e.target.value)}>
                    {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <label>Pick Blank</label>
              <div className="bg-slate-800 border border-slate-700 rounded p-4 font-mono text-sm">
                {tpl.parts.map((part, i) => (
                  <Fragment key={i}>
                    <span>{part}</span>
                    {i < tpl.blanks && <span className={blankStyle(i === +blankIndex)} onClick={() => setBlankIndex(String(i))}>{i}</span>}
                  </Fragment>
                ))}
              </div>
            </div>

            <div>
              <label>Your Word</label>
              <input type="text" className="block w-full mt-1 bg-slate-800 border rounded px-2 py-1" value={word} onChange={e => setWord(e.target.value)} />
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
