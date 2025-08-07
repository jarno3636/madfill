// pages/round/[id].jsx
'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryV3_ABI.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { categories } from '@/data/templates'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import Link from 'next/link'
import Image from 'next/image'
import { fetchFarcasterProfile } from '@/lib/neynar'

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
  const [profiles, setProfiles] = useState({})

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
        const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)

        const [info, votes, winnerVoters] = await Promise.all([
          ct.getPool2Info(BigInt(id)),
          ct.getPool2Votes(BigInt(id)),
          ct.getPool2Winners(BigInt(id))
        ])

        const tplIx = Number(localStorage.getItem(`madfill-tplIdx-${id}`)) || 0
        const catIx = Number(localStorage.getItem(`madfill-catIdx-${id}`)) || 0
        const name = localStorage.getItem(`madfill-roundname-${id}`) || 'Untitled'
        const tpl = categories?.[catIx]?.templates?.[tplIx]

        const previewText = tpl?.parts.map((part, i) =>
          i === info.blankIndex
            ? part + info.originalWord
            : i < tpl.blanks
            ? part + '____'
            : part
        ).join('')

        const challengerPreview = tpl?.parts.map((part, i) =>
          i === info.blankIndex
            ? part + info.challengerWord
            : i < tpl.blanks
            ? part + '____'
            : part
        ).join('')

        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
        const json = await res.json()
        setBasePrice(json.base?.usd || 0)

        const profileMap = {}
        await Promise.all(winnerVoters.map(async (addr) => {
          const profile = await fetchFarcasterProfile(addr)
          if (profile) profileMap[addr.toLowerCase()] = profile
        }))

        setProfiles(profileMap)

        setRoundData({
          tpl,
          name,
          deadline: Number(info.voteDeadline),
          originalWord: info.originalWord,
          challengerWord: info.challengerWord,
          votes: {
            original: votes[0].length,
            challenger: votes[1].length
          },
          winnerSide: info.winnerSide, // 0 = original, 1 = challenger
          prizeCount: winnerVoters.length,
          winnerVoters,
          previewText,
          challengerPreview
        })
      } catch (e) {
        console.error(e)
        setError(e.message || 'Failed to load round')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  async function handleClaim() {
    try {
      setStatus('Claiming...')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      await (await ct.claimPool2(BigInt(id))).wait()
      setClaimed(true)
      setStatus('✅ Claimed!')
    } catch (e) {
      console.error(e)
      setStatus('❌ ' + (e.message || 'Claim failed'))
    }
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
              <Card className={`bg-slate-900 text-white shadow-xl ${roundData.winnerSide === 0 ? 'ring-2 ring-green-400' : ''}`}>
                <CardHeader className="text-center font-bold bg-slate-800">😂 Original Card</CardHeader>
                <CardContent className="p-4 text-center italic">{roundData.previewText}</CardContent>
              </Card>

              <Card className={`bg-slate-900 text-white shadow-xl ${roundData.winnerSide === 1 ? 'ring-2 ring-green-400' : ''}`}>
                <CardHeader className="text-center font-bold bg-slate-800">😆 Challenger Card</CardHeader>
                <CardContent className="p-4 text-center italic">{roundData.challengerPreview}</CardContent>
              </Card>
            </div>

            <div className="space-y-3 text-sm">
              <p>🗳️ Votes — 😂: <strong>{roundData.votes.original}</strong> | 😆: <strong>{roundData.votes.challenger}</strong></p>
              <p>💰 Winners: <strong>{roundData.prizeCount}</strong> voters split prize pool</p>
              <p>🏁 Status: <span className="text-yellow-300">{roundData.winnerSide === 0 ? 'Original Wins' : 'Challenger Wins'}</span></p>

              {Number(roundData.deadline) < Date.now() / 1000 &&
                roundData.winnerVoters.includes(address?.toLowerCase()) &&
                !claimed && (
                <Button onClick={handleClaim} className="bg-green-600 hover:bg-green-500">
                  🎁 Claim Your Winnings
                </Button>
              )}
              {claimed && <p className="text-green-400 font-bold">✅ Prize Claimed!</p>}
              {status && <p className="text-yellow-300">{status}</p>}

              <div className="text-xs text-slate-400 mt-4">
                Share this round:
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Vote on MadFill Round #${id}! https://madfill.vercel.app/round/${id}`)}`}
                  target="_blank"
                  className="ml-2 underline text-blue-400"
                >🐦 Twitter</a>
                <span className="mx-2">|</span>
                <a
                  href={`https://warpcast.com/~/compose?text=${encodeURIComponent(`Vote on MadFill Round #${id}! https://madfill.vercel.app/round/${id}`)}`}
                  target="_blank"
                  className="underline text-purple-400"
                >🌀 Warpcast</a>
              </div>

              <Link href="/vote" className="text-indigo-300 underline text-sm block mt-1">
                ← Back to Vote History
              </Link>

              {roundData.winnerVoters?.length > 0 && (
                <div className="text-sm text-slate-300 mt-4">
                  🧑‍🤝‍🧑 Winners:
                  <div className="flex flex-wrap gap-3 mt-2">
                    {roundData.winnerVoters.map((a, i) => {
                      const profile = profiles[a.toLowerCase()]
                      return (
                        <div key={i} className="text-xs text-center w-16">
                          <Image
                            src={profile?.pfp_url || `https://effigy.im/a/${a.toLowerCase()}`}
                            alt="avatar"
                            width={32}
                            height={32}
                            className="rounded-full mx-auto"
                          />
                          <div className="truncate text-white/80 mt-1">
                            {profile?.username ? `@${profile.username}` : a.slice(2, 6)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {claimed && <Confetti width={width} height={height} />}
          </>
        )}
      </main>
    </Layout>
  )
}
