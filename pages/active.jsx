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
  const [rounds, setRounds]       = useState(null)
  const [search, setSearch]       = useState('')
  const [sortOption, setSortOption] = useState('timeAsc')
  const [debug, setDebug]         = useState({
    address: '', fromBlock: 0, latestBlock: 0,
    startedIds: [], paidIds: [], openIds: [], error: ''
  })

  useEffect(() => {
    ;(async () => {
      try {
        // ── 1) CONFIG ─────────────────────────────────────────────────────────
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL
        if (!address) throw new Error('Missing NEXT_PUBLIC_FILLIN_ADDRESS')
        if (!rpcUrl)  throw new Error('Missing NEXT_PUBLIC_ALCHEMY_URL')

        // ── 2) FALLBACK PROVIDER ────────────────────────────────────────────
        const provider = new ethers.FallbackProvider([
          new ethers.JsonRpcProvider(rpcUrl),
          new ethers.JsonRpcProvider('https://mainnet.base.org'),
        ])

        const contract = new ethers.Contract(address, abi, provider)

        // ── 3) BLOCK RANGE ──────────────────────────────────────────────────
        const latestBlock = await provider.getBlockNumber()
        // Only scan from your contract’s deployment block (set this in Vercel),
        // or fallback to 33631502 if you haven’t set it yet
        const fromBlockEnv = Number(process.env.NEXT_PUBLIC_START_BLOCK)
        const fromBlock    = fromBlockEnv > 0 ? fromBlockEnv : 33631502
        const batchSize    = 500

        // ── 4) BATCH‐FETCH HELPER ───────────────────────────────────────────
        async function fetchEvents(filter) {
          let all = []
          for (let start = fromBlock; start <= latestBlock; start += batchSize) {
            const end = Math.min(start + batchSize - 1, latestBlock)
            const logs = await provider.getLogs({
              address,
              topics:  filter.topics,
              fromBlock: start,
              toBlock:   end
            })
            // parse each log back into an ethers Event-like shape
            const parsed = logs.map((log) =>
              contract.interface.parseLog(log).args
            )
            all = all.concat(parsed.map(args => ({ args })))
          }
          return all
        }

        // ── 5) PULL STARTED & PAID EVENTS ───────────────────────────────────
        const startedEvs = await fetchEvents(contract.filters.Started())
        const paidEvs    = await fetchEvents(contract.filters.Paid())

        const startedIds = startedEvs.map(e => Number(e.args.id))
        const paidIds    = paidEvs.map(e => Number(e.args.id))

        // ── 6) TALLY POOLS ──────────────────────────────────────────────────
        const poolCounts = paidIds.reduce((acc, id) => {
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        // ── 7) BUILD OPEN ROUNDS ────────────────────────────────────────────
        const now = Math.floor(Date.now() / 1000)
        const openRounds = startedEvs
          .map(e => {
            const id       = Number(e.args.id)
            const blanks   = Number(e.args.blanks)
            const deadline = Number(e.args.deadline)
            return {
              id,
              blanks,
              deadline,
              poolCount: poolCounts[id] || 0
            }
          })
          .filter(r => r.deadline > now)

        // ── 8) UPDATE STATE ─────────────────────────────────────────────────
        setRounds(openRounds)
        setDebug({
          address,
          fromBlock,
          latestBlock,
          startedIds,
          paidIds,
          openIds: openRounds.map(r => r.id),
          error: ''
        })
      } catch (err) {
        // on any failure, show friendly fallback and record debug
        setRounds([])
        setDebug(d => ({ ...d, error: err.message }))
      }
    })()
  }, [])

  // ── FILTER & SORT ─────────────────────────────────────────────────────
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

        <h1 className="text-3xl font-extrabold text-center text-indigo-400">
          🏁 Active Rounds
        </h1>

        {/* ── DEBUG PANEL ──────────────────────────────────────────────────── */}
        <Card className="bg-slate-200 text-slate-800">
          <CardHeader><h2 className="font-bold">🔧 Debug Info</h2></CardHeader>
          <CardContent className="text-sm space-y-1">
            {debug.error
              ? <p className="text-red-600">Error: {debug.error}</p>
              : <>
                  <p><strong>Contract:</strong> {debug.address}</p>
                  <p><strong>Blocks:</strong> {debug.fromBlock} → {debug.latestBlock}</p>
                  <p><strong>Started IDs:</strong> {debug.startedIds.join(', ') || '—'}</p>
                  <p><strong>Paid IDs:</strong>    {debug.paidIds.join(', ')    || '—'}</p>
                  <p><strong>Open IDs:</strong>    {debug.openIds.join(', ')    || '—'}</p>
                </>
            }
          </CardContent>
        </Card>

        {/* ── SEARCH & SORT ────────────────────────────────────────────────── */}
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

        {/* ── ROUNDS LIST ──────────────────────────────────────────────────── */}
        {rounds === null ? (
          <p className="text-center text-slate-400">Loading active rounds…</p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-slate-400">No open rounds found.</p>
        ) : (
          sorted.map(r => (
            <Card key={r.id} className="bg-slate-800 text-white shadow-lg rounded-xl">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Round #{r.id}</h2>
                  <p className="text-sm opacity-75">
                    {r.blanks} blank{r.blanks > 1 ? 's' : ''} &nbsp;•&nbsp; {r.poolCount} entr{r.poolCount === 1 ? 'y' : 'ies'}
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
          ))
        )}
      </main>

      <Footer />
    </Layout>
  )
}
