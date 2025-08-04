// pages/my-rounds.jsx
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '@/abi/FillInStoryFull.json'
import Link from 'next/link'

export default function MyRounds() {
  const [address, setAddress] = useState(null)
  const [rounds, setRounds]   = useState([])
  const [loading, setLoading] = useState(true)
  const [claimedId, setClaimedId] = useState(null)
  const { width, height }     = useWindowSize()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then(accts => setAddress(accts[0]))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!address) return
    setLoading(true)

    (async () => {
      try {
        const RPC      = 'https://mainnet.base.org'
        const provider = new ethers.JsonRpcProvider(RPC)
        const ct       = new ethers.Contract(
          process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
          abi,
          provider
        )

        // 1) pull all Started, Paid, Draw1 events
        const [started, paid, draws] = await Promise.all([
          ct.queryFilter(ct.filters.Started(), 0, 'latest'),
          ct.queryFilter(ct.filters.Paid(),    0, 'latest'),
          ct.queryFilter(ct.filters.Draw1(),   0, 'latest'),
        ])

        // 2) group your participations by roundId
        const myPaid = paid
          .filter(e => e.args.author.toLowerCase() === address.toLowerCase())
        const entriesByRound = myPaid.reduce((acc, e) => {
          const id = e.args.id.toString()
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        // 3) find which you won
        const winners = draws.reduce((acc,e)=>{
          acc[e.args.id.toString()] = e.args.winner.toLowerCase()
          return acc
        }, {})

        // 4) assemble your rounds
        const myRounds = []
        for (let ev of started) {
          const id = ev.args.id.toString()
          if (!entriesByRound[id] && winners[id] !== address.toLowerCase()) {
            // neither entered nor won → skip
            continue
          }
          // fetch on-chain round info
          const info = await ct.rounds(BigInt(id))
          const fee  = info.fee // per-entry fee in wei
          // check if already claimed
          const claimed = await ct.c1(BigInt(id))

          myRounds.push({
            id,
            entries: entriesByRound[id] || 0,
            isWinner: winners[id] === address.toLowerCase(),
            claimed,
            prize: Number(ethers.formatEther(fee.mul(entriesByRound[id]||0))).toFixed(4)
          })
        }

        // newest first
        setRounds(myRounds.reverse())
      } catch (err) {
        console.error('Error loading My Rounds:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [address])

  async function handleClaim(id) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer   = await provider.getSigner()
      const ct       = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      const tx = await ct.claim1(BigInt(id))
      await tx.wait()
      setClaimedId(id)
      setTimeout(() => setClaimedId(null), 3000)
      // update UI
      setRounds(rs => rs.map(r=>
        r.id===id ? {...r, claimed:true} : r
      ))
    } catch (err) {
      console.error('Claim failed:', err)
      alert('Error claiming prize')
    }
  }

  return (
    <Layout>
      <Head>
        <title>My Rounds | MadFill</title>
      </Head>

      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6 text-white">🏆 My Rounds</h2>

        {loading && (
          <p className="text-white">Loading your rounds…</p>
        )}

        {!loading && rounds.length === 0 && (
          <p className="text-white">You haven’t played or won any rounds yet.</p>
        )}

        {rounds.map(r => (
          <Card key={r.id} className="mb-4 bg-slate-800 text-white shadow-lg">
            <CardHeader className="flex justify-between items-center">
              <div>
                <h3 className="font-bold">Round #{r.id}</h3>
                <p className="text-sm text-indigo-300">
                  Prize: {r.prize} BASE
                </p>
              </div>
              <Link href={`/round/${r.id}`}>
                <a className="text-indigo-400 underline text-sm">🔍 View</a>
              </Link>
            </CardHeader>

            <CardContent className="space-y-2 text-sm">
              {r.isWinner && !r.claimed && (
                <Button
                  onClick={() => handleClaim(r.id)}
                  className="bg-green-600 hover:bg-green-500 mt-2"
                >
                  🎉 Claim Prize
                </Button>
              )}
              {r.isWinner && r.claimed && (
                <p className="text-green-400">✅ Prize Claimed</p>
              )}
              {!r.isWinner && r.entries > 0 && (
                <p className="text-slate-300">🎮 You entered {r.entries} time{r.entries>1?'s':''}</p>
              )}

              <div className="mt-3 flex gap-2 flex-wrap">
                <a
                  href={`https://twitter.com/intent/tweet?text=I just played MadFill Round #${r.id}! Join me: https://madfill.vercel.app/round/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white text-sm"
                >
                  🐦 Share
                </a>
                <a
                  href={`https://warpcast.com/~/compose?text=I just played MadFill Round #${r.id}! Join me: https://madfill.vercel.app/round/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-white text-sm"
                >
                  🌀 Warpcast
                </a>
              </div>
            </CardContent>
          </Card>
        ))}

        {claimedId && (
          <Confetti width={width} height={height} />
        )}
      </div>
    </Layout>
  )
}
