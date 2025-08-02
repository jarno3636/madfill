// pages/active.jsx
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

export default function Active() {
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all') // 'all' | 'paid' | 'free'

  useEffect(() => {
    async function load() {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)

      const [started, paid, free] = await Promise.all([
        contract.queryFilter(contract.filters.Started(), 0, 'latest'),
        contract.queryFilter(contract.filters.Paid(),    0, 'latest'),
        contract.queryFilter(contract.filters.Free(),    0, 'latest'),
      ])

      const paidCountMap = {}
      paid.forEach(e => {
        const id = e.args.id.toNumber()
        paidCountMap[id] = (paidCountMap[id]||0) + 1
      })

      const freeCountMap = {}
      free.forEach(e => {
        const id = e.args.id.toNumber()
        freeCountMap[id] = (freeCountMap[id]||0) + 1
      })

      const now = Math.floor(Date.now()/1000)
      const items = started.map(e => {
        const id    = e.args.id.toNumber()
        const fee   = parseFloat(ethers.formatEther(e.args.entryFee))
        const dl    = e.args.deadline.toNumber()
        const rem   = Math.max(dl - now, 0)
        return {
          id,
          fee,
          deadline: dl,
          timeRemaining: rem,
          paidCount: paidCountMap[id]||0,
          freeCount: freeCountMap[id]||0,
          pool: (paidCountMap[id]||0) * fee,
        }
      }).filter(r => r.timeRemaining > 0)

      setRounds(items)
      setLoading(false)
    }
    load()
  }, [])

  // filter by tab
  const filtered = rounds.filter(r => {
    if (tab === 'paid') return r.paidCount > 0
    if (tab === 'free') return r.freeCount > 0
    return true
  })

  return (
    <>
      <Head><title>Active Rounds | MadFill</title></Head>
      <nav className="flex justify-between items-center p-4 bg-gray-100">
        <h1 className="text-xl font-bold"><a href="/">MadFill</a></h1>
        <div className="space-x-4">
          <a href="/" className="text-blue-600">Home</a>
          <a href="/active" className="text-blue-600">Active Rounds</a>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto p-4 space-y-6">
        <h1 className="text-3xl font-bold text-center">Active Rounds</h1>

        {/* Tabs */}
        <div className="flex justify-center space-x-4">
          {['all','paid','free'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded ${
                tab===t ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center">Loading rounds…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center">No {tab} rounds found.</p>
        ) : filtered.map(r => (
          <Card key={r.id}>
            <CardHeader>Round #{r.id}</CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Pool:</strong> {r.pool.toFixed(3)} BASE</p>
              <p><strong>Paid Entries:</strong> {r.paidCount}</p>
              <p><strong>Free Entries:</strong> {r.freeCount}</p>
              <p>
                <strong>Time Left:</strong> {Math.floor(r.timeRemaining/3600)}h{' '}
                {Math.floor((r.timeRemaining%3600)/60)}m
              </p>
              <Button onClick={() => window.location.href = `/?roundId=${r.id}`}>
                Participate
              </Button>
            </CardContent>
          </Card>
        ))}
      </main>
    </>
  )
}
