import Head from 'next/head'
import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryFull.json'
import Link from 'next/link'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'

export default function MyRounds() {
  const [address, setAddress] = useState(null)
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [successId, setSuccessId] = useState(null)
  const { width, height } = useWindowSize()

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accounts => setAddress(accounts[0]))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!address) return

    const fetchRounds = async () => {
      setLoading(true)
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const startedEvents = await contract.queryFilter(contract.filters.Started())
        const drawEvents = await contract.queryFilter(contract.filters.Draw1())

        const myRounds = []

        for (let evt of startedEvents) {
          const roundId = evt.args.id.toString()
          let roundInfo
          try {
            roundInfo = await contract.rounds(roundId)
          } catch {
            continue
          }

          let hasParticipated = false
          try {
            const submissions = await contract.getSubmissions(roundId)
            hasParticipated = submissions.some(s =>
              s.author?.toLowerCase() === address.toLowerCase()
            )
          } catch {}

          const winnerEvent = drawEvents.find(e => e.args.id.toString() === roundId)
          const isWinner = winnerEvent && winnerEvent.args.winner.toLowerCase() === address.toLowerCase()

          let claimed = false
          try {
            claimed = await contract.c1(roundId)
          } catch {}

          if (hasParticipated || isWinner) {
            const poolAmount = ethers.formatEther(roundInfo.fee * roundInfo.n)
            myRounds.push({
              id: roundId,
              isWinner,
              hasParticipated,
              deadline: roundInfo.deadline?.toNumber?.() || 0,
              claimed,
              prize: parseFloat(poolAmount).toFixed(3)
            })
          }
        }

        setRounds(myRounds.reverse())
      } catch (err) {
        console.error('Error loading rounds:', err)
      }
      setLoading(false)
    }

    fetchRounds()
  }, [address])

  async function handleClaim(id) {
    try {
      const modal = new ethers.BrowserProvider(window.ethereum)
      const signer = await modal.getSigner()
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      const tx = await contract.claim1(id)
      await tx.wait()
      setSuccessId(id)
      setTimeout(() => setSuccessId(null), 3000)
    } catch (err) {
      console.error('Claim failed:', err)
      alert('Error claiming prize')
    }
  }

  return (
    <Layout>
      <Head><title>My Rounds | MadFill</title></Head>
      <h2 className="text-2xl font-bold mb-6 text-white">🏆 My Rounds</h2>
      {loading && <p className="text-white">Loading your rounds…</p>}
      {!loading && rounds.length === 0 && <p className="text-white">You haven’t played yet. Join a round!</p>}

      {rounds.map(r => (
        <Card key={r.id} className="mb-4 bg-slate-800 text-white shadow-lg">
          <CardHeader className="flex justify-between items-center">
            <div>
              <h3 className="font-bold">Round #{r.id}</h3>
              <p className="text-sm text-indigo-300">Prize: {r.prize} BASE</p>
            </div>
            <Link href={`/round/${r.id}`} className="text-indigo-400 underline text-sm">🔍 View</Link>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {r.isWinner && !r.claimed && (
              <Button onClick={() => handleClaim(r.id)} className="bg-green-600 hover:bg-green-500 mt-2">
                🎉 Claim Prize
              </Button>
            )}
            {r.isWinner && r.claimed && <p className="text-green-400">✅ Prize Claimed</p>}
            {!r.isWinner && r.hasParticipated && <p className="text-slate-300">🎮 Participated</p>}

            <div className="mt-3 flex gap-2 flex-wrap">
              <a
                href={`https://twitter.com/intent/tweet?text=Check out my MadFill Round! https://madfill.vercel.app/round/${r.id}`}
                target="_blank"
                className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white text-sm"
              >
                🐦 Share
              </a>
              <a
                href={`https://warpcast.com/~/compose?text=Check out my MadFill Round! https://madfill.vercel.app/round/${r.id}`}
                target="_blank"
                className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-white text-sm"
              >
                🌀 Warpcast
              </a>
            </div>
          </CardContent>
        </Card>
      ))}

      {successId && <Confetti width={width} height={height} />}
    </Layout>
  )
}
