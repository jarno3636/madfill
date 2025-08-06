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

        const withCounts = await Promise.all(open.map(async r => {
          const info = await ct.rounds(BigInt(r.id))
          return {
            ...r,
            vP: info.vP.toString(),
            vF: info.vF.toString(),
            totalVotes: parseInt(info.vP) + parseInt(info.vF),
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
    if (filter === 'low') return r.totalVotes <= 2
    return true
  })

  return (
    <Layout>
      <Head><title>Community Vote | MadFill</title></Head>
      {success && <Confetti width={width} height={height} />}

      <h1 className="text-3xl font-bold text-white mb-6">🗳️ Community Vote</h1>

      <div className="flex gap-4 mb-4">
        <label className="text-white">Filter:</label>
        <select
          className="bg-slate-800 text-white border p-2 rounded"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="all">All Rounds</option>
          <option value="high">🔥 Most Voted</option>
          <option value="low">🆕 New or Low Votes</option>
        </select>
      </div>

      <Card className="bg-gradient-to-br from-purple-900 to-indigo-900 text-white shadow-xl mb-6">
        <CardHeader><h2 className="text-xl font-bold">How It Works</h2></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Each completed MadFill card can be challenged. Now it’s up to the community to vote for the funniest version!</p>
          <ul className="list-disc list-inside mt-2">
            <li>⏳ 24-hour voting period</li>
            <li>💸 0.001 BASE per vote (1 per wallet per round)</li>
            <li>🏆 One random voter on the winning side wins the prize pool (minus fee)</li>
          </ul>
          <p className="text-yellow-300 mt-2">💡 Share your favorite and get your friends to vote!</p>
          <p className="text-sm mt-2">
            Want to challenge someone?{' '}
            <Link href="/challenge" className="underline text-indigo-300">Submit a Challenger</Link>
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-white">Loading rounds eligible for voting…</p>
      ) : filtered.length === 0 ? (
        <p className="text-white">No active voting rounds at the moment.</p>
      ) : (
        <div className="grid gap-6">
          {filtered.map(r => (
            <Card key={r.id} className="bg-slate-800 text-white shadow-lg">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">Round #{r.id}</h3>
                  <p className="text-sm text-slate-300">🗳️ Votes – Original: {r.vP} | Challenger: {r.vF}</p>
                </div>
                <Link href={`/round/${r.id}`} className="text-indigo-400 underline text-sm">🔍 View</Link>
              </CardHeader>
              <CardContent className="space-y-4">
                <CompareCards roundId={r.id} />
                <div className="space-y-2">
                  <p>Which card deserves the crown? 💥</p>
                  <div className="flex gap-4">
                    <Button onClick={() => vote(r.id, true)} className="bg-green-600 hover:bg-green-500">
                      😂 Original
                    </Button>
                    <Button onClick={() => vote(r.id, false)} className="bg-blue-600 hover:bg-blue-500">
                      😆 Challenger
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-3">
                  Share this round:
                  <a href={`https://twitter.com/intent/tweet?text=Vote on MadFill Round #${r.id}! https://madfill.vercel.app/round/${r.id}`} target="_blank" className="ml-2 underline text-blue-400">🐦 Twitter</a>
                  <span className="mx-2">|</span>
                  <a href={`https://warpcast.com/~/compose?text=Vote on MadFill Round #${r.id}! https://madfill.vercel.app/round/${r.id}`} target="_blank" className="underline text-purple-400">🌀 Warpcast</a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {status && <p className="text-white text-sm mt-4">{status}</p>}
    </Layout>
  )
}
