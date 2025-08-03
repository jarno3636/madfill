// pages/myrounds.jsx
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryFull.json'
import Link from 'next/link'

export default function MyRounds() {
  const [address, setAddress] = useState(null)
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accounts => {
          setAddress(accounts[0])
        })
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
          const roundInfo = await contract.rounds(roundId)
          const submissions = await contract.getSubmissions(roundId)
          const hasParticipated = submissions.some(s => ethers.decodeBytes32String(s.word) && s.author.toLowerCase() === address.toLowerCase())
          const winnerEvent = drawEvents.find(e => e.args.id.toString() === roundId)
          const isWinner = winnerEvent && winnerEvent.args.winner.toLowerCase() === address.toLowerCase()

          if (hasParticipated || isWinner) {
            myRounds.push({
              id: roundId,
              isWinner,
              hasParticipated,
              deadline: roundInfo.sd.toNumber(),
              claimed: await contract.c1(roundId),
              prize: (roundInfo.fee * roundInfo.n / 1e18).toFixed(3)
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
      alert('Claimed successfully!')
      location.reload()
    } catch (err) {
      console.error('Claim failed:', err)
      alert('Error claiming prize')
    }
  }

  return (
    <Layout>
      <Head><title>My Rounds | MadFill</title></Head>
      <h2 className="text-xl font-bold mb-4 text-white">🏆 My Rounds</h2>
      {loading && <p className="text-white">Loading…</p>}
      {!loading && rounds.length === 0 && <p className="text-white">No participation yet. Join a round!</p>}

      {rounds.map(r => (
        <Card key={r.id} className="mb-4 bg-slate-800 text-white">
          <CardHeader className="flex justify-between items-center">
            <div>
              <h3 className="font-bold">Round #{r.id}</h3>
              <p className="text-sm">Prize: {r.prize} BASE</p>
            </div>
            <Link href={`/round/${r.id}`} className="text-indigo-400 underline text-sm">View</Link>
          </CardHeader>
          <CardContent>
            {r.isWinner && !r.claimed && (
              <Button onClick={() => handleClaim(r.id)} className="bg-green-600 hover:bg-green-500 mt-2">Claim Prize</Button>
            )}
            {r.isWinner && r.claimed && <p className="text-green-400 mt-2">Prize Claimed</p>}
            {!r.isWinner && r.hasParticipated && <p className="text-sm text-slate-300">Participation recorded</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`https://twitter.com/intent/tweet?text=Check out my MadFill Round! https://madfill.vercel.app/round/${r.id}`} target="_blank" className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white text-sm">Share on Twitter</a>
              <a href={`https://warpcast.com/~/compose?text=Check out my MadFill Round! https://madfill.vercel.app/round/${r.id}`} target="_blank" className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-white text-sm">Share on Farcaster</a>
            </div>
          </CardContent>
        </Card>
      ))}
    </Layout>
  )
}
