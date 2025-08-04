// pages/vote.jsx
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryFull.json'
import { useWindowSize } from 'react-use'
import Confetti from 'react-confetti'
import Link from 'next/link'
import CompareCards from '@/components/CompareCards'

export default function VotePage() {
  const [rounds, setRounds]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [status, setStatus]     = useState('')
  const [address, setAddress]   = useState(null)
  const [success, setSuccess]   = useState(false)
  const { width, height }       = useWindowSize()

  // Connect wallet
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then(accounts => setAddress(accounts[0]))
        .catch(console.error)
    }
  }, [])

  // Fetch voting‐eligible rounds
  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL
        if (!address || !rpcUrl) throw new Error('Missing configuration')

        // fallback provider (Alchemy + Base RPC)
        const alchemy = new ethers.JsonRpcProvider(rpcUrl)
        const fallback = new ethers.FallbackProvider([
          alchemy,
          new ethers.JsonRpcProvider('https://mainnet.base.org'),
        ])
        const ct = new ethers.Contract(address, abi, fallback)

        // get all FinalF events in batches of 500 blocks
        const latest = await fallback.getBlockNumber()
        const from   = Number(process.env.NEXT_PUBLIC_START_BLOCK) || 0
        const size   = 500

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

        // filter to ones still open for voting
        const now = Math.floor(Date.now() / 1000)
        const open = allEvents
          .map(e => ({
            id: e.id.toString(),
            voteDeadline: Number(e.voteDeadline),
          }))
          .filter(r => r.voteDeadline > now)

        // decorate with current vote counts
        const withCounts = await Promise.all(open.map(async r => {
          const info = await ct.rounds(BigInt(r.id))
          return {
            ...r,
            vP: info.vP.toString(),
            vF: info.vF.toString(),
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

  // submit vote
  async function vote(id, supportPaid) {
    try {
      if (!address) throw new Error('Connect your wallet first')
      setStatus('⏳ Submitting vote…')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer   = await provider.getSigner()
      const ct       = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
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

  return (
    <Layout>
      <Head><title>Community Vote | MadFill</title></Head>
      {success && <Confetti width={width} height={height} />}

      <h1 className="text-3xl font-bold text-white mb-4">🗳️ Community Vote</h1>

      <Card className="bg-gradient-to-br from-purple-900 to-indigo-900 text-white shadow-xl">
        <CardHeader><h2 className="text-xl font-bold">How It Works</h2></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Each MadFill round has an Original & Challenger card now up for community voting.</p>
          <p>Voting costs <strong>0.001 BASE</strong>. One vote per wallet per round.</p>
          <ul className="list-disc list-inside">
            <li>⏳ Voting window: 24 hrs after challenge</li>
            <li>🏆 Random voter on winning side wins the pool (minus fees)</li>
          </ul>
          <p className="text-yellow-300">💡 Share your favorite side to sway the vote!</p>
          <p className="text-sm">
            Want to challenge yourself?{' '}
            <Link href="/challenge"><a className="underline text-indigo-300">Submit a Challenger</a></Link>
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-white mt-6">Loading voting rounds…</p>
      ) : rounds.length === 0 ? (
        <p className="text-white mt-6">No active voting rounds found.</p>
      ) : (
        <div className="grid gap-4 mt-6">
          {rounds.map(r => (
            <Card key={r.id} className="bg-slate-800 text-white shadow-lg">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Round #{r.id}</h3>
                  <p className="text-sm text-slate-300">
                    Original votes: {r.vP} Challenger votes: {r.vF}
                  </p>
                </div>
                <Link href={`/round/${r.id}`}><a className="text-indigo-400 underline text-sm">🔍 View</a></Link>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <CompareCards roundId={r.id} />
                <p>Which one cracked you up?</p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => vote(r.id, true)}
                    className="bg-green-600 hover:bg-green-500"
                  >😂 Original</Button>
                  <Button
                    onClick={() => vote(r.id, false)}
                    className="bg-blue-600 hover:bg-blue-500"
                  >😆 Challenger</Button>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Share: 
                  <a
                    href={`https://twitter.com/intent/tweet?text=Vote on MadFill round #${r.id}! https://madfill.vercel.app/round/${r.id}`}
                    target="_blank"
                    className="ml-2 underline text-blue-400"
                  >Twitter</a>
                  <span className="mx-1">|</span>
                  <a
                    href={`https://warpcast.com/~/compose?text=Vote on MadFill round #${r.id}! https://madfill.vercel.app/round/${r.id}`}
                    target="_blank"
                    className="underline text-purple-400"
                  >Warpcast</a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {status && <p className="mt-4 text-white text-sm">{status}</p>}
    </Layout>
  )
}
