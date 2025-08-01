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
  const [sort, setSort] = useState('ending') // 'ending' or 'pool'

  useEffect(() => {
    async function load() {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        provider
      )

      // 1) Fetch on-chain events
      const started = await contract.queryFilter(contract.filters.Started(), 0, 'latest')
      const paid = await contract.queryFilter(contract.filters.Paid(), 0, 'latest')

      // 2) Build paidCount map
      const paidCountMap = {}
      paid.forEach((e) => {
        const id = e.args.id.toNumber()
        paidCountMap[id] = (paidCountMap[id] || 0) + 1
      })

      // 3) Map to UI model, filter out expired
      const now = Math.floor(Date.now() / 1000)
      const items = started
        .map((e) => {
          const id = e.args.id.toNumber()
          const fee = parseFloat(ethers.formatEther(e.args.entryFee))
          const deadline = e.args.deadline.toNumber()
          const timeRemaining = Math.max(deadline - now, 0)
          const paidCount = paidCountMap[id] || 0
          const pool = paidCount * fee
          return { id, fee, deadline, timeRemaining, paidCount, pool }
        })
        .filter((r) => r.timeRemaining > 0)

      setRounds(items)
      setLoading(false)
    }
    load()
  }, [])

  // 4) Sort per selection
  const sorted = [...rounds].sort((a, b) => {
    if (sort === 'pool') return b.pool - a.pool
    return a.timeRemaining - b.timeRemaining
  })

  return (
    <>
      <Head><title>Active Rounds | MadFill</title></Head>
      <main className="max-w-3xl mx-auto p-4 space-y-6">
        <h1 className="text-4xl font-extrabold text-center">Active MadFill Rounds</h1>

        {/* Sort selector */}
        <div className="flex justify-end">
          <label className="mr-2">Sort by:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="ending">Ending Soonest</option>
            <option value="pool">Largest Pool</option>
          </select>
        </div>

        {/* Loading state */}
        {loading && <p>Loading rounds…</p>}

        {/* Rounds list */}
        {sorted.map((r) => (
          <Card key={r.id}>
            <CardHeader>Round #{r.id}</CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Pool:</strong> {r.pool.toFixed(3)} BASE</p>
              <p><strong>Entries:</strong> {r.paidCount}</p>
              <p>
                <strong>Time Remaining:</strong>{' '}
                {Math.floor(r.timeRemaining / 3600)}h{' '}
                {Math.floor((r.timeRemaining % 3600) / 60)}m
              </p>
              <Button
                onClick={() => (window.location.href = `/?roundId=${r.id}`)}
              >
                Participate
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* No rounds */}
        {!loading && sorted.length === 0 && (
          <p className="text-center">No active rounds at the moment.</p>
        )}
      </main>
    </>
  )
}
