import Head from 'next/head'
import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '@/abi/FillInStoryV2_ABI.json'
import Link from 'next/link'
import Countdown from '@/components/Countdown'

export default function MyRounds() {
  const [address, setAddress] = useState(null)
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimedId, setClaimedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const { width, height } = useWindowSize()

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

    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(
          process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
          abi,
          provider
        )

        const poolCount = await ct.pool1Count()
        const entries = await ct.getEntries(address)

        const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
        const basePrice = (await priceRes.json()).base.usd

        const result = []
        for (let i = 0; i < poolCount; i++) {
          const info = await ct.getPool1Info(i)
          const userEntries = entries.filter(e => e.poolId.toString() === i.toString())
          const isWinner = info.winner?.toLowerCase() === address.toLowerCase()
          const claimed = await ct.c1(BigInt(i))
          const name = localStorage.getItem(`madfill-roundname-${i}`) || 'Untitled'

          if (userEntries.length > 0 || isWinner) {
            result.push({
              id: i,
              name,
              entries: userEntries.length,
              prize: ((info.entryFee / 1e6) * userEntries.length).toFixed(2),
              usd: ((info.entryFee / 1e6) * userEntries.length * basePrice).toFixed(2),
              isWinner,
              claimed,
              deadline: Number(info.deadline) * 1000
            })
          }
        }

        setRounds(result)
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
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      const tx = await ct.claim1(BigInt(id))
      await tx.wait()
      setClaimedId(id)
      setTimeout(() => setClaimedId(null), 3000)
      setRounds(rs => rs.map(r => (r.id === id ? { ...r, claimed: true } : r)))
    } catch (err) {
      console.error('Claim failed:', err)
      alert('Error claiming prize')
    }
  }

  function filteredSortedRounds() {
    let rs = [...rounds]

    if (filter === 'unclaimed') {
      rs = rs.filter(r => r.isWinner && !r.claimed)
    } else if (filter === 'won') {
      rs = rs.filter(r => r.isWinner)
    }

    if (sortBy === 'oldest') {
      rs.sort((a, b) => a.id - b.id)
    } else if (sortBy === 'prize') {
      rs.sort((a, b) => parseFloat(b.usd) - parseFloat(a.usd))
    } else {
      rs.sort((a, b) => b.id - a.id)
    }

    return rs
  }

  return (
    <Layout>
      <Head>
        <title>My Rounds | MadFill</title>
      </Head>

      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6 text-white">🏆 My Rounds</h2>

        <div className="mb-4 flex flex-wrap items-center gap-4 text-white">
          <div>
            <label className="mr-2">Filter:</label>
            <select className="bg-slate-800 border p-1 rounded" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="unclaimed">Unclaimed Wins</option>
              <option value="won">Wins Only</option>
            </select>
          </div>
          <div>
            <label className="mr-2">Sort by:</label>
            <select className="bg-slate-800 border p-1 rounded" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="prize">Prize (USD)</option>
            </select>
          </div>
        </div>

        {loading && <p className="text-white">Loading your rounds…</p>}

        {!loading && filteredSortedRounds().length === 0 && (
          <p className="text-white">No rounds to show based on selected filter.</p>
        )}

        {filteredSortedRounds().map(r => (
          <Card key={r.id} className="mb-4 bg-slate-800 text-white shadow-lg">
            <CardHeader className="flex justify-between items-center">
              <div>
                <h3 className="font-bold">#{r.id} — {r.name}</h3>
                <p className="text-sm text-indigo-300">
                  💰 {r.prize} BASE (${r.usd}) — {r.entries} entr{r.entries === 1 ? 'y' : 'ies'}
                </p>
              </div>
              <Link href={`/round/${r.id}`} className="text-indigo-400 underline text-sm">🔍 View</Link>
            </CardHeader>

            <CardContent className="space-y-2 text-sm">
              <p>⏰ Ends in: <Countdown endTime={r.deadline} /></p>

              {r.isWinner && !r.claimed && (
                <Button onClick={() => handleClaim(r.id)} className="bg-green-600 hover:bg-green-500 mt-2">
                  🎉 Claim Prize
                </Button>
              )}
              {r.isWinner && r.claimed && (
                <p className="text-green-400">✅ Prize Claimed</p>
              )}
              {!r.isWinner && r.entries > 0 && (
                <p className="text-slate-300">🎮 You entered {r.entries} time{r.entries > 1 ? 's' : ''}</p>
              )}

              <div className="mt-3 flex gap-2 flex-wrap">
                <a href={`https://twitter.com/intent/tweet?text=I just played MadFill Round #${r.id}! Join me: https://madfill.vercel.app/round/${r.id}`} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white text-sm">
                  🐦 Share
                </a>
                <a href={`https://warpcast.com/~/compose?text=I just played MadFill Round #${r.id}! Join me: https://madfill.vercel.app/round/${r.id}`} target="_blank" rel="noreferrer" className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-white text-sm">
                  🌀 Warpcast
                </a>
              </div>
            </CardContent>
          </Card>
        ))}

        {claimedId && <Confetti width={width} height={height} />}
      </div>
    </Layout>
  )
}
