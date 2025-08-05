// pages/round/[id].jsx
'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryV2_ABI.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { categories } from '@/data/templates'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'

export default function RoundDetailPage() {
  const { query } = useRouter()
  const id = query.id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [roundData, setRoundData] = useState(null)
  const [address, setAddress] = useState(null)
  const [status, setStatus] = useState('')
  const [claimed, setClaimed] = useState(false)
  const [basePrice, setBasePrice] = useState(0)
  const { width, height } = useWindowSize()

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accts => setAddress(accts[0]))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(
          process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
          abi,
          provider
        )

        const [info, subs, votes] = await Promise.all([
          ct.getPool1Info(BigInt(id)),
          Promise.all([
            ct.getPool1Submission(BigInt(id), address || ethers.ZeroAddress)
          ]),
          ct.getPool2Votes(BigInt(id))
        ])

        const tplIx = Number(localStorage.getItem(`madfill-tplIdx-${id}`)) || 0
        const catIx = Number(localStorage.getItem(`madfill-catIdx-${id}`)) || 0
        const name = localStorage.getItem(`madfill-roundname-${id}`) || 'Untitled'
        const tpl = categories?.[catIx]?.templates?.[tplIx]

        const originalWords = subs.map(sub => sub.word).filter(Boolean)

        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
        const json = await res.json()
        setBasePrice(json.base?.usd || 0)

        setRoundData({
          tpl,
          name,
          deadline: Number(info.deadline),
          originalWords,
          votes: {
            original: votes[0].length,
            challenger: votes[1].length
          },
          winner: info.winner?.toLowerCase(),
          prizeCount: info.participants?.length || 0
        })
      } catch (e) {
        console.error(e)
        setError(e.message || 'Failed to load round')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, address])

  async function handleClaim() {
    try {
      setStatus('Claiming...')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      await (await ct.claimPool1(BigInt(id))).wait()
      setClaimed(true)
      setStatus('✅ Claimed!')
    } catch (e) {
      console.error(e)
      setStatus('❌ ' + (e.message || 'Claim failed'))
    }
  }

  function renderCard(parts, words, title, highlight) {
    return (
      <Card className={`bg-slate-900 text-white shadow-xl overflow-hidden transition ${highlight ? 'ring-4 ring-yellow-400' : ''}`}>
        <CardHeader className="bg-slate-800 text-center font-bold text-white">
          {title}
        </CardHeader>
        <CardContent className="p-4 text-center font-mono text-lg leading-relaxed">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < words.length && (
                <span className="text-yellow-300">{ethers.decodeBytes32String(words[i])}</span>
              )}
            </span>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Layout>
      <Head><title>MadFill Round #{id}</title></Head>
      <main className="max-w-3xl mx-auto p-4 space-y-6 text-white">
        {loading && <p>Loading round…</p>}
        {error && <p className="text-red-400">Error: {error}</p>}

        {roundData && (
          <>
            <h1 className="text-3xl font-bold text-center text-indigo-300">
              Round #{id} — {roundData.name}
            </h1>

            <div className="grid md:grid-cols-2 gap-6">
              {renderCard(
                roundData.tpl?.parts || ['Missing template'],
                roundData.originalWords,
                'Submissions',
                true
              )}
            </div>

            <div className="space-y-2">
              <p>🗳️ Votes — Original: <strong>{roundData.votes.original}</strong> | Challenger: <strong>{roundData.votes.challenger}</strong></p>
              <p>
                💰 Prize pool: <strong>{roundData.prizeCount} × $1 = ${(roundData.prizeCount * basePrice).toFixed(2)} USD</strong>
              </p>
              <p className="break-all">
                🏆 Winner address: <code className="text-green-400">{roundData.winner}</code>
              </p>

              {Number(roundData.deadline) < Date.now() / 1000 &&
               address?.toLowerCase() === roundData.winner &&
               !claimed && (
                <Button onClick={handleClaim} className="bg-green-600 hover:bg-green-500">
                  🎁 Claim Prize
                </Button>
              )}
              {claimed && <p className="text-green-400">✅ Prize Claimed!</p>}
              {status && <p className="text-yellow-300">{status}</p>}
            </div>

            {claimed && <Confetti width={width} height={height} />}
          </>
        )}
      </main>
    </Layout>
  )
}
