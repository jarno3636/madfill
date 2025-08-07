// pages/vote.jsx
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryV3_ABI.json'
import { useWindowSize } from 'react-use'
import Confetti from 'react-confetti'
import Link from 'next/link'
import CompareCards from '@/components/CompareCards'

export default function VotePage() {
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [address, setAddress] = useState(null)
  const [success, setSuccess] = useState(false)
  const [claimedId, setClaimedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const { width, height } = useWindowSize()

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then(accounts => setAddress(accounts[0]))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const contractAddr = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_URL
        const alchemy = new ethers.JsonRpcProvider(rpcUrl)
        const fallback = new ethers.FallbackProvider([
          alchemy,
          new ethers.JsonRpcProvider('https://mainnet.base.org'),
        ])
        const ct = new ethers.Contract(contractAddr, abi, fallback)

        const count = await ct.pool2Count()
        const now = Math.floor(Date.now() / 1000)
        const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
        const basePrice = (await priceRes.json()).base.usd

        const result = []
        for (let i = 1; i <= count; i++) {
          const info = await ct.getPool2Info(i)
          const deadline = Number(info[6])
          const claimed = info[10]
          const winner = info[7]
          const pool = Number(info[4]) / 1e18
          const usd = (pool * basePrice).toFixed(2)
          const vP = Number(info[8])
          const vF = Number(info[9])
          const userVotedWinner = address?.toLowerCase() === winner?.toLowerCase()

          result.push({
            id: i,
            deadline,
            claimed,
            winner,
            isEnded: now > deadline,
            base: pool.toFixed(4),
            usd,
            vP,
            vF,
            totalVotes: vP + vF,
            close: Math.abs(vP - vF) <= 2,
            big: pool > 5,
            userVotedWinner,
          })
        }

        setRounds(result)
      } catch (e) {
        console.error('Error loading vote rounds', e)
        setRounds([])
      } finally {
        setLoading(false)
      }
    })()
  }, [address])

  async function vote(id, supportPaid) {
    try {
      if (!address) throw new Error('Connect your wallet first')
      setStatus('⏳ Submitting vote…')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      const tx = await ct.vote2(BigInt(id), supportPaid, {
        value: ethers.parseEther('0.001'),
      })
      await tx.wait()
      setStatus('✅ Vote recorded!')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      console.error(e)
      const msg = e?.message?.split('(')[0] || 'Vote failed'
      setStatus('❌ ' + msg)
    }
  }

  async function claim(id) {
    try {
      setStatus('⏳ Claiming prize…')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      const tx = await ct.claimPool2(BigInt(id))
      await tx.wait()
      setClaimedId(id)
      setStatus('✅ Prize claimed!')
      setTimeout(() => setClaimedId(null), 3000)
    } catch (err) {
      console.error('Claim failed:', err)
      setStatus('❌ Error claiming prize')
    }
  }

  const filtered = rounds.filter(r => {
    if (filter === 'high') return r.totalVotes >= 10
    if (filter === 'close') return r.close
    if (filter === 'big') return Number(r.usd) > 5
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'votes') return b.totalVotes - a.totalVotes
    if (sortBy === 'prize') return b.usd - a.usd
    return b.id - a.id
  })

  return (
    <Layout>
      <Head><title>Community Vote | MadFill</title></Head>
      {success && <Confetti width={width} height={height} />}
      {claimedId && <Confetti width={width} height={height} />}

      <div className="max-w-4xl mx-auto p-6 text-white">
        <h1 className="text-3xl font-bold mb-4">🗳️ Community Vote</h1>
        <p className="mb-4 text-slate-300">
          Vote between the Original & Challenger cards! Winning side splits the prize pool. Each vote costs 0.001 BASE.
        </p>
        <Link href="/challenge" className="inline-block mb-6 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-medium">
          ➕ Submit a Challenger
        </Link>

        <div className="flex flex-wrap gap-4 mb-6">
          <select className="bg-slate-800 border p-2 rounded" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="high">🔥 Most Voted</option>
            <option value="close">⚖️ Close Vote</option>
            <option value="big">💰 Big Prize</option>
          </select>
          <select className="bg-slate-800 border p-2 rounded" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="recent">📅 Newest</option>
            <option value="votes">📊 Top Votes</option>
            <option value="prize">💰 Largest Pool</option>
          </select>
        </div>

        {loading ? (
          <p>Loading voting rounds…</p>
        ) : sorted.length === 0 ? (
          <p>No active voting rounds right now.</p>
        ) : (
          <div className="grid gap-6">
            {sorted.map(r => {
              const emoji = ['🐸', '🦊', '🦄', '🐢', '🐙'][r.id % 5]
              const baseLink = `https://madfill.vercel.app/round/${r.id}`
              const shareText = encodeURIComponent(`Vote on MadFill Round #${r.id}! 🧠\n${baseLink}`)
              return (
                <Card key={r.id} className="bg-slate-800 text-white shadow-lg border border-indigo-700 rounded-lg">
                  <CardHeader className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">{emoji} Round #{r.id}</h3>
                      <p className="text-sm text-slate-300">Votes – 😂: {r.vP} | 😆: {r.vF}</p>
                      {r.close && <span className="text-yellow-300 text-xs">⚖️ Close Match!</span>}
                      <p className="text-xs mt-1 text-green-300">💰 Pool: ${r.usd}</p>
                    </div>
                    <Link href={`/round/${r.id}`} className="text-indigo-400 underline text-sm">🔍 View</Link>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CompareCards roundId={r.id} />

                    {r.isEnded ? (
                      <>
                        <p className="text-sm">🏁 Voting ended!</p>
                        {r.userVotedWinner && !r.claimed && (
                          <Button onClick={() => claim(r.id)} className="bg-green-600 hover:bg-green-500">
                            🎉 Claim Prize
                          </Button>
                        )}
                        {r.userVotedWinner && r.claimed && (
                          <p className="text-green-400 font-medium">✅ Prize Claimed</p>
                        )}
                        {!r.userVotedWinner && <p className="text-slate-400">😢 You didn’t win this round</p>}
                      </>
                    ) : (
                      <>
                        <p className="text-sm">Cast your vote 👇</p>
                        <div className="flex gap-4">
                          <Button onClick={() => vote(r.id, true)} className="bg-green-600 hover:bg-green-500">
                            😂 Original
                          </Button>
                          <Button onClick={() => vote(r.id, false)} className="bg-blue-600 hover:bg-blue-500">
                            😆 Challenger
                          </Button>
                        </div>
                      </>
                    )}

                    <div className="text-xs text-slate-400 mt-3">
                      Share this round:
                      <a href={`https://twitter.com/intent/tweet?text=${shareText}`} target="_blank" className="ml-2 underline text-blue-400">🐦 Twitter</a>
                      <span className="mx-2">|</span>
                      <a href={`https://warpcast.com/~/compose?text=${shareText}`} target="_blank" className="underline text-purple-400">🌀 Warpcast</a>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {status && <p className="text-sm mt-4 text-white">{status}</p>}
      </div>
    </Layout>
  )
}
