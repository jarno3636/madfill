// pages/vote.jsx
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryV2_ABI.json'
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
    (async () => {
      setLoading(true)
      try {
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_URL
        const alchemy = new ethers.JsonRpcProvider(rpcUrl)
        const fallback = new ethers.FallbackProvider([
          alchemy,
          new ethers.JsonRpcProvider('https://mainnet.base.org'),
        ])
        const ct = new ethers.Contract(address, abi, fallback)

        const latest = await fallback.getBlockNumber()
        const from = Number(process.env.NEXT_PUBLIC_START_BLOCK) || 0
        const size = 500
        const allEvents = []

        for (let start = from; start <= latest; start += size) {
          const end = Math.min(start + size - 1, latest)
          const logs = await alchemy.getLogs({
            address,
            topics: ct.filters.FinalF().topics,
            fromBlock: start,
            toBlock: end,
          })
          logs.forEach(log => {
            const parsed = ct.interface.parseLog(log).args
            allEvents.push(parsed)
          })
        }

        const now = Math.floor(Date.now() / 1000)
        const open = allEvents
          .map(e => ({
            id: e.id.toString(),
            voteDeadline: Number(e.voteDeadline),
          }))
          .filter(r => r.voteDeadline > now)

        const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
        const basePrice = (await priceRes.json()).base.usd

        const withCounts = await Promise.all(open.map(async r => {
          const info = await ct.rounds(BigInt(r.id))
          const poolSizeUsd = Number(info.vP + info.vF) * 0.001 * basePrice
          return {
            ...r,
            vP: info.vP.toString(),
            vF: info.vF.toString(),
            totalVotes: parseInt(info.vP) + parseInt(info.vF),
            usd: poolSizeUsd.toFixed(2)
          }
        }))

        setRounds(withCounts)
      } catch (e) {
        console.error('Error loading vote rounds', e)
        setRounds([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function vote(id, supportPaid) {
    try {
      if (!address) throw new Error('Connect your wallet first')
      setStatus('⏳ Submitting vote...')
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
      setStatus('❌ ' + (e.message || 'Vote failed'))
    }
  }

  const filtered = rounds.filter(r => {
    if (filter === 'high') return r.totalVotes >= 10
    if (filter === 'close') return Math.abs(r.vP - r.vF) <= 2
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

      <h1 className="text-3xl font-bold text-white mb-6">🗳️ Community Vote</h1>

      <div className="flex flex-wrap gap-4 mb-6 text-white">
        <select
          className="bg-slate-800 border p-2 rounded"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="high">🔥 Most Voted</option>
          <option value="close">⚖️ Close Vote</option>
          <option value="big">💰 Big Prize</option>
        </select>
        <select
          className="bg-slate-800 border p-2 rounded"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="recent">📅 Newest</option>
          <option value="votes">📊 Top Votes</option>
          <option value="prize">💰 Largest Pool</option>
        </select>
      </div>

      {loading ? (
        <p className="text-white">Loading voting rounds…</p>
      ) : sorted.length === 0 ? (
        <p className="text-white">No active voting rounds right now.</p>
      ) : (
        <div className="grid gap-6">
          {sorted.map(r => {
            const isClose = Math.abs(r.vP - r.vF) <= 2
            const emoji = ['🐸', '🦊', '🦄', '🐢', '🐙'][r.id % 5]
            return (
              <Card key={r.id} className="bg-slate-800 text-white shadow-lg">
                <CardHeader className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{emoji} Round #{r.id}</h3>
                    <p className="text-sm text-slate-300">Votes – Original: {r.vP} | Challenger: {r.vF}</p>
                    {isClose && <span className="text-yellow-300 text-xs">⚖️ Close Match!</span>}
                    <p className="text-xs mt-1 text-green-300">💰 Pool: ${r.usd}</p>
                  </div>
                  <Link href={`/round/${r.id}`} className="text-indigo-400 underline text-sm">🔍 View</Link>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CompareCards roundId={r.id} />
                  <p>Cast your vote 👇</p>
                  <div className="flex gap-4">
                    <Button onClick={() => vote(r.id, true)} className="bg-green-600 hover:bg-green-500">
                      😂 Original
                    </Button>
                    <Button onClick={() => vote(r.id, false)} className="bg-blue-600 hover:bg-blue-500">
                      😆 Challenger
                    </Button>
                  </div>
                  <div className="text-xs text-slate-400 mt-3">
                    Share this round:
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Vote on MadFill Round #${r.id}! https://madfill.vercel.app/round/${r.id}`)}`}
                      target="_blank"
                      className="ml-2 underline text-blue-400"
                    >🐦 Twitter</a>
                    <span className="mx-2">|</span>
                    <a
                      href={`https://warpcast.com/~/compose?text=${encodeURIComponent(`Vote on MadFill Round #${r.id}! https://madfill.vercel.app/round/${r.id}`)}`}
                      target="_blank"
                      className="underline text-purple-400"
                    >🌀 Warpcast</a>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {status && <p className="text-white text-sm mt-4">{status}</p>}
    </Layout>
  )
}
