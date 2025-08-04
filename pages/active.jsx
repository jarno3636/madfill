// pages/active‐rounds.jsx
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '../abi/FillInStoryFull.json'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function ActiveRoundsPage() {
  const [rounds, setRounds]         = useState(null)
  const [search, setSearch]         = useState('')
  const [sortOption, setSortOption] = useState('timeAsc')
  const [debug, setDebug]           = useState({
    address:     null,
    fromBlock:   null,
    latestBlock: null,
    startedIds:  [],
    paidIds:     [],
    openIds:     [],
    error:       null
  })

  useEffect(() => {
    ;(async () => {
      try {
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        if (!address) throw new Error('NEXT_PUBLIC_FILLIN_ADDRESS not set')

        // build a FallbackProvider: Base RPC + Alchemy
        const baseRpc    = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const alchemyRpc = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_ALCHEMY_URL)
        const provider   = new ethers.FallbackProvider([ baseRpc, alchemyRpc ])

        // determine block range
        const latestBlock = await provider.getBlockNumber()
        const envFrom     = process.env.NEXT_PUBLIC_START_BLOCK
        const fromBlock   = envFrom
          ? Number(envFrom)
          : Math.max(0, latestBlock - 200_000)

        const ct = new ethers.Contract(address, abi, provider)

        // helper to page through logs in ≤500-block windows
        async function fetchEventsInRange(filter, start, end) {
          const CHUNK = 500
          let events = []
          for (let b = start; b <= end; b += CHUNK) {
            const to = Math.min(b + CHUNK - 1, end)
            const ev = await ct.queryFilter(filter, b, to)
            events = events.concat(ev)
          }
          return events
        }

        // 1) Started events
        const startedFilter = ct.filters.Started()
        const startedEvs    = await fetchEventsInRange(startedFilter, fromBlock, latestBlock)
        const startedIds    = startedEvs.map(e => e.args.id.toNumber())

        // 2) Paid events
        const paidFilter = ct.filters.Paid()
        const paidEvs    = await fetchEventsInRange(paidFilter, fromBlock, latestBlock)
        const paidIds    = paidEvs.map(e => e.args.id.toNumber())

        // tally pools
        const poolCounts = paidIds.reduce((acc, id) => {
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        // build open rounds
        const now = Math.floor(Date.now() / 1000)
        const openRounds = startedEvs
          .map(e => {
            const id       = e.args.id.toNumber()
            const deadline = e.args.deadline.toNumber()
            return {
              id,
              blanks:    e.args.blanks.toNumber(),
              deadline,
              poolCount: poolCounts[id] || 0
            }
          })
          .filter(r => r.deadline > now)

        setRounds(openRounds)
        setDebug({
          address,
          fromBlock,
          latestBlock,
          startedIds,
          paidIds,
          openIds: openRounds.map(r => r.id),
          error: null
        })
      } catch (err) {
        console.error(err)
        setRounds([])
        setDebug(d => ({ ...d, error: err.message }))
      }
    })()
  }, [])

  // filter + sort
  const filtered = (rounds || []).filter(r =>
    !search || String(r.id).includes(search.trim())
  )
  const sorted = [...filtered].sort((a, b) => {
    switch (sortOption) {
      case 'timeAsc':   return a.deadline  - b.deadline
      case 'timeDesc':  return b.deadline  - a.deadline
      case 'poolAsc':   return a.poolCount - b.poolCount
      case 'poolDesc':  return b.poolCount - a.poolCount
      default:          return 0
    }
  })

  return (
    <Layout>
      <Head><title>MadFill • Active Rounds</title></Head>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-3xl font-extrabold text-center text-indigo-400">🏁 Active Rounds</h1>

        {/* Debug Panel (disable/remove when happy) */}
        <Card className="bg-slate-200 text-slate-800">
          <CardHeader><h2 className="font-bold">🔧 Debug Info</h2></CardHeader>
          <CardContent className="text-sm space-y-1">
            {debug.error
              ? <p className="text-red-600">Error: {debug.error}</p>
              : <>
                  <p><strong>Contract:</strong> {debug.address}</p>
                  <p><strong>Blocks:</strong> from {debug.fromBlock} to {debug.latestBlock}</p>
                  <p><strong>Started IDs:</strong> {debug.startedIds.join(', ') || '—'}</p>
                  <p><strong>Paid IDs:</strong>    {debug.paidIds.join(', ')    || '—'}</p>
                  <p><strong>Open IDs:</strong>    {debug.openIds.join(', ')    || '—'}</p>
                </>
            }
          </CardContent>
        </Card>

        {/* Search & Sort */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <input
            type="text"
            placeholder="🔍 Filter by Round ID"
            className="flex-1 bg-slate-900 text-white rounded px-3 py-2"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="bg-slate-900 text-white rounded px-3 py-2"
            value={sortOption}
            onChange={e => setSortOption(e.target.value)}
          >
            <option value="timeAsc">⏱️ Time ↑</option>
            <option value="timeDesc">⏱️ Time ↓</option>
            <option value="poolAsc">💰 Pool ↑</option>
            <option value="poolDesc">💰 Pool ↓</option>
          </select>
        </div>

        {/* Rounds List */}
        {rounds === null ? (
          <p className="text-center text-slate-400">Loading active rounds…</p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-slate-400">No open rounds found.</p>
        ) : sorted.map(r => (
          <Card key={r.id} className="bg-slate-800 text-white shadow-lg rounded-xl">
            <CardHeader className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Round #{r.id}</h2>
                <p className="text-sm opacity-75">
                  {r.blanks} blank{r.blanks > 1 ? 's' : ''} • {r.poolCount} entr{r.poolCount === 1 ? 'y' : 'ies'}
                </p>
              </div>
              <Countdown targetTimestamp={r.deadline} />
            </CardHeader>
            <CardContent className="flex justify-end">
              <Link href={`/round/${r.id}`}>
                <a className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded">
                  View & Enter
                </a>
              </Link>
            </CardContent>
          </Card>
        ))}
      </main>

      <Footer />
    </Layout>
  )
}
