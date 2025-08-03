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

export default function VotePage() {
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [address, setAddress] = useState(null)
  const [success, setSuccess] = useState(false)
  const { width, height } = useWindowSize()

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accounts => setAddress(accounts[0]))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    async function fetchRounds() {
      setLoading(true)
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const started = await contract.queryFilter(contract.filters.FinalF())
        const now = Math.floor(Date.now() / 1000)
        const valid = []
        for (let e of started) {
          const id = e.args.id.toString()
          const vd = e.args.voteDeadline.toNumber()
          if (now <= vd) {
            const r = await contract.rounds(id)
            valid.push({
              id,
              vd,
              vP: r.vP.toString(),
              vF: r.vF.toString()
            })
          }
        }
        setRounds(valid)
      } catch (e) {
        console.error('Error fetching voting rounds', e)
      }
      setLoading(false)
    }
    fetchRounds()
  }, [])

  async function vote(id, supportPaid) {
    try {
      if (!window.ethereum) throw new Error('Wallet not found')
      setStatus('Submitting your vote...')
      const modal = new ethers.BrowserProvider(window.ethereum)
      const signer = await modal.getSigner()
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      const tx = await contract.vote2(id, supportPaid, { value: ethers.parseEther('0.001') })
      await tx.wait()
      setStatus('✅ Vote submitted!')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setStatus('❌ ' + (e.message || 'Vote failed'))
    }
  }

  return (
    <Layout>
      <Head><title>Community Vote | MadFill</title></Head>
      {success && <Confetti width={width} height={height} />}

      <h1 className="text-3xl font-bold text-white mb-4">🗳️ Community Vote</h1>

      <Card className="bg-gradient-to-br from-purple-900 to-indigo-900 text-white shadow-xl">
        <CardHeader>
          <h2 className="text-xl font-bold">How It Works</h2>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Each MadFill round has an Original Card and a Challenger Card submitted by another player.</p>
          <p>Now it's time for the community to vote which one is funnier!</p>
          <p>Voting costs <strong>0.001 BASE</strong>. Everyone who votes for the winning side is entered into a prize draw.</p>
          <ul className="list-disc list-inside">
            <li>✅ One vote per wallet per round</li>
            <li>⏳ Voting lasts 24 hours after the challenge</li>
            <li>🏆 One random voter from the winning side receives the prize pool (minus fees)</li>
          </ul>
          <p className="text-yellow-300">💡 Tip: Invite your friends to vote for your side and help you win!</p>
          <p className="text-sm mt-2">Want to challenge a card and join the fun? <Link href="/challenge" className="underline text-indigo-300">Submit a Challenger Card</Link></p>
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
                  <p className="text-sm text-slate-300">Votes Original: {r.vP} | Challenger: {r.vF}</p>
                </div>
                <Link href={`/round/${r.id}`} className="text-indigo-400 underline text-sm">🔍 View</Link>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Which card made you laugh more?</p>
                <div className="flex gap-2">
                  <Button onClick={() => vote(r.id, true)} className="bg-green-600 hover:bg-green-500">😂 Original</Button>
                  <Button onClick={() => vote(r.id, false)} className="bg-blue-600 hover:bg-blue-500">😆 Challenger</Button>
                </div>
                <div className="mt-2 text-xs text-slate-300">
                  📣 Share this round: 
                  <a
                    href={`https://twitter.com/intent/tweet?text=Vote on my hilarious MadFill round! https://madfill.vercel.app/round/${r.id}`}
                    target="_blank"
                    className="ml-2 underline text-blue-400"
                  >Twitter</a>
                  <span className="mx-1">|</span>
                  <a
                    href={`https://warpcast.com/~/compose?text=Vote on my hilarious MadFill round! https://madfill.vercel.app/round/${r.id}`}
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
