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
  const [debug, setDebug]           = useState({ from:0, to:0, started:[], paid:[], open:[], error:null })

  useEffect(() => {
    ;(async () => {
      try {
        const address    = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const startBlock = Number(process.env.NEXT_PUBLIC_START_BLOCK || 0)
        if (!address) throw new Error('FILLIN_ADDRESS not set')

        // Build fallback provider: Alchemy first, then Base RPC
        const provider = new ethers.FallbackProvider([
          new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_ALCHEMY_URL),
          new ethers.JsonRpcProvider('https://mainnet.base.org'),
        ])

        const ct = new ethers.Contract(address, abi, provider)
        const latest = await provider.getBlockNumber()

        // Clamp to last 500 blocks to avoid Alchemy's limit
        const fromBlock = Math.max(startBlock, latest - 500)

        // Fetch events only in that window
        const startedEvs = await ct.queryFilter(ct.filters.Started(), fromBlock, latest)
        const paidEvs    = await ct.queryFilter(ct.filters.Paid(),    fromBlock, latest)

        const startedIds = startedEvs.map(e => e.args.id.toNumber())
        const paidIds    = paidEvs.map(e    => e.args.id.toNumber())

        // Tally pool sizes
        const poolCounts = paidIds.reduce((acc,id) => {
          acc[id] = (acc[id]||0) + 1
          return acc
        }, {})

        // Build open rounds (deadline > now)
        const now = Math.floor(Date.now()/1000)
        const openRounds = startedEvs
          .map(e => {
            const id       = e.args.id.toNumber()
            const blanks   = e.args.blanks.toNumber()
            const deadline = e.args.deadline.toNumber()
            return { id, blanks, deadline, poolCount: poolCounts[id]||0 }
          })
          .filter(r => r.deadline > now)

        setDebug({
          from: fromBlock,
          to: latest,
          started: startedIds,
          paid:    paidIds,
          open:    openRounds.map(r=>r.id),
          error:   null
        })
        setRounds(openRounds)

      } catch (err) {
        console.error(err)
        setDebug(d => ({ ...d, error: err.message }))
        setRounds([])  // force “no rounds” display
      }
    })()
  }, [])

  // Filter & sort
  const filtered = (rounds||[]).filter(r =>
    !search || String(r.id).includes(search.trim())
  )
  const sorted = [...filtered].sort((a,b)=> {
    switch(sortOption) {
      case 'timeAsc':  return a.deadline - b.deadline
      case 'timeDesc': return b.deadline - a.deadline
      case 'poolAsc':  return a.poolCount - b.poolCount
      case 'poolDesc': return b.poolCount - a.poolCount
      default: return 0
    }
  })

  return (
    <Layout>
      <Head><title>MadFill • Active Rounds</title></Head>
      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-3xl font-extrabold text-center text-indigo-400">
          🏁 Active Rounds
        </h1>

        {/* Debug panel */}
        <Card className="bg-slate-200 text-slate-800">
          <CardHeader><h2 className="font-bold">🔧 Debug Info</h2></CardHeader>
          <CardContent className="text-sm">
            {debug.error
              ? <p className="text-red-600">Error: {debug.error}</p>
              : <>
                  <p>Blocks scanned: {debug.from} → {debug.to}</p>
                  <p>Started IDs: {debug.started.join(', ') || '—'}</p>
                  <p>Paid IDs:    {debug.paid.join(', ')    || '—'}</p>
                  <p>Open IDs:    {debug.open.join(', ')    || '—'}</p>
                </> }
          </CardContent>
        </Card>

        {/* Search & Sort */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <input
            type="text"
            placeholder="🔍 Filter by Round ID"
            className="flex-1 bg-slate-900 text-white rounded px-3 py-2"
            value={search} onChange={e=>setSearch(e.target.value)}
          />
          <select
            className="bg-slate-900 text-white rounded px-3 py-2"
            value={sortOption} onChange={e=>setSortOption(e.target.value)}
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
          <p className="text-center text-slate-400">
            ⚠️ Unable to load active rounds right now. Please try again shortly.
          </p>
        ) : sorted.map(r => (
          <Card key={r.id} className="bg-slate-800 text-white shadow-lg rounded-xl">
            <CardHeader className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Round #{r.id}</h2>
                <p className="text-sm opacity-75">
                  {r.blanks} blank{r.blanks>1?'s':''} • {r.poolCount} entr{r.poolCount===1?'y':'ies'}
                </p>
              </div>
              <Countdown targetTimestamp={r.deadline} />
            </CardHeader>
            <CardContent className="flex justify-end">
              <Link href={`/round/${r.id}`}>
                <a className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded">
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
