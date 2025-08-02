import { useRouter } from 'next/router'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryFull.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import Link from 'next/link'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'

export default function RoundPage() {
  const router = useRouter()
  const { id } = router.query

  const [round, setRound] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [tpl, setTpl] = useState(null)
  const [name, setName] = useState('')
  const [winner, setWinner] = useState(null)
  const [claimed, setClaimed] = useState(false)
  const [status, setStatus] = useState('')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const [preview, setPreview] = useState('')
  const { width, height } = useWindowSize()

  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)

        const info = await ct.rounds(BigInt(id))
        const template = getTemplate(info.t?.toNumber?.() || 0, info.b.toNumber())
        setTpl(template)
        setRound(info)
        setName(localStorage.getItem(`madfill-roundname-${id}`) || `Round #${id}`)

        const allSubs = await ct.getSubmissions(BigInt(id))
        const decoded = allSubs.map((bytes32, i) => ({
          index: i,
          word: ethers.decodeBytes32String(bytes32),
        }))
        setSubmissions(decoded)

        const w = await ct.w1(BigInt(id))
        setWinner(w)

        const c = await ct.c1(BigInt(id))
        setClaimed(c)

        const pv = template.parts
          .map((part, j) => (j < template.blanks ? `${part}${decoded.find(d => d.index === j)?.word || '____'}` : part))
          .join('')
        setPreview(pv)

        if (window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum)
          const signer = await provider.getSigner()
          const addr = await signer.getAddress()
          setUser(addr.toLowerCase())
        }

      } catch (err) {
        console.error('Error loading round data', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  function getTemplate(templateIndex, blanks) {
    let flat = []
    for (const c of require('@/data/templates').categories) {
      for (const t of c.templates) flat.push(t)
    }
    const t = flat[templateIndex] || flat[0]
    if (t.blanks !== blanks) {
      return { name: 'Unknown', blanks, parts: Array(blanks + 1).fill(' ') }
    }
    return t
  }

  async function handleClaimPrize() {
    try {
      setStatus('⏳ Claiming prize...')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      const tx = await ct.claim1(BigInt(id))
      await tx.wait()
      setStatus('✅ Prize claimed successfully!')
      setClaimed(true)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 5000)
    } catch (e) {
      setStatus('❌ ' + (e.reason || e.message || 'Claim failed.'))
    }
  }

  if (loading || !round || !tpl) {
    return (
      <Layout>
        <main className="max-w-2xl mx-auto p-6 text-white">⏳ Loading round info…</main>
      </Layout>
    )
  }

  const deadline = round.sd.toNumber()
  const now = Math.floor(Date.now() / 1000)
  const isOver = now > deadline
  const canClaim = winner && user && winner.toLowerCase() === user && !claimed
  const share = encodeURIComponent(`Check out this hilarious MadFill round 🧠\n\n${preview}\n\nhttps://madfill.vercel.app/round/${id}`)

  return (
    <Layout>
      <Head><title>{name} | MadFill</title></Head>
      {showConfetti && <Confetti width={width} height={height} />}

      <main className="max-w-3xl mx-auto p-6 space-y-6 text-white">
        <Card className="bg-gradient-to-tr from-slate-800 to-purple-800 shadow-lg rounded-xl">
          <CardHeader>
            <h2 className="text-xl font-bold">🧠 {name}</h2>
            <p className="text-sm text-indigo-200">Template: {tpl.name}</p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Prize Pool:</strong> {(round.e * round.n / 1e18).toFixed(3)} BASE</p>
            <p><strong>Entries:</strong> {round.n.toString()}</p>
            <p>
              <strong>Deadline:</strong>{' '}
              {isOver ? (
                <span className="text-red-400">Closed</span>
              ) : (
                <Countdown targetTimestamp={deadline} />
              )}
            </p>
            {winner && <p><strong>Winner:</strong> <code>{winner}</code></p>}
            {canClaim && (
              <button
                onClick={handleClaimPrize}
                className="mt-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded shadow"
              >
                🎉 Claim Prize
              </button>
            )}
            {status && <p className="text-sm mt-2">{status}</p>}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border border-slate-700 rounded-xl shadow text-white">
          <CardHeader>
            <h3 className="text-lg font-semibold">📝 Submissions</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {submissions.length === 0 && <p>No entries yet.</p>}
            {submissions.map((s, i) => {
              const finalText = tpl.parts
                .map((part, j) => (j < tpl.blanks ? `${part}${j === s.index ? s.word : '____'}` : part))
                .join('')
              return (
                <div key={i} className="p-3 border border-slate-700 rounded bg-slate-800 text-sm">
                  <p><strong>Blank #{s.index}:</strong> {s.word}</p>
                  <p>{finalText}</p>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Share Links */}
        <div className="space-y-2">
          <p className="font-semibold text-white">📣 Share this round:</p>
          <div className="flex gap-3 flex-wrap">
            <a href={`https://twitter.com/intent/tweet?text=${share}`} target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">🐦 Twitter</a>
            <a href={`https://warpcast.com/~/compose?text=${share}`} target="_blank" className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded">🌀 Farcaster</a>
            <Link href="/" className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded">⬅️ Back Home</Link>
          </div>
        </div>
      </main>
    </Layout>
  )
}
