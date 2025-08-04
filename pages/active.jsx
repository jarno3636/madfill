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
  const [rounds, setRounds] = useState(null)     // null = loading, [] = none
  const [search, setSearch] = useState('')
  const [sortOption, setSortOption] = useState('timeAsc')
  const [error, setError]   = useState('')

  useEffect(() => {
    (async () => {
      try {
        // ── CONFIG ─────────────────────────────────────────────────────────
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL
        if (!address) throw new Error('Missing NEXT_PUBLIC_FILLIN_ADDRESS')
        if (!rpcUrl)   throw new Error('Missing NEXT_PUBLIC_ALCHEMY_URL')

        // ── PROVIDER ──────────────────────────────────────────────────────
        const provider = new ethers.FallbackProvider([
          new ethers.JsonRpcProvider(rpcUrl),
          new ethers.JsonRpcProvider('https://mainnet.base.org'),
        ])
        const contract = new ethers.Contract(address, abi, provider)

        // ── BLOCK RANGE / BATCH ───────────────────────────────────────────
        const latest    = await provider.getBlockNumber()
        const fromEnv   = Number(process.env.NEXT_PUBLIC_START_BLOCK) || 0
        const start     = fromEnv > 0 ? fromEnv : 33631502
        const BATCH     = 500

        // ── FETCH & PARSE HELPER ─────────────────────────────────────────
        async function fetchArgs(filter) {
          const all = []
          // slice into 500-block chunks
          for (let b = start; b <= latest; b += BATCH) {
            const to = Math.min(b + BATCH - 1, latest)
            const logs = await provider.getLogs({
              address,
              topics: filter.topics,
              fromBlock: b,
              toBlock:   to
            })
            logs.forEach(log => {
              const args = contract.interface.parseLog(log).args
              all.push(args)
            })
          }
          return all
        }

        // ── PULL STARTED & PAID IN PARALLEL ───────────────────────────────
        const [started, paid] = await Promise.all([
          fetchArgs(contract.filters.Started()),
          fetchArgs(contract.filters.Paid())
        ])

        // ── TALLY POOLS ──────────────────────────────────────────────────
        const poolCounts = paid.reduce((acc, ev) => {
          const id = Number(ev.id)
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        // ── BUILD OPEN ROUNDS ────────────────────────────────────────────
        const now = Math.floor(Date.now() / 1000)
        const openRounds = started
          .map(ev => ({
            id:        Number(ev.id),
            blanks:    Number(ev.blanks),
            deadline:  Number(ev.deadline),
            poolCount: poolCounts[Number(ev.id)] || 0
          }))
          .filter(r => r.deadline > now)

        setRounds(openRounds)
      } catch (e) {
        console.error(e)
        setError(e.message)
        setRounds([])
      }
    })()
  }, [])

  // ── FILTER & SORT ───────────────────────────────────────────────────
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
      <Head>
        <title>MadFill • Active Rounds</title>
      </Head>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-3xl font-extrabold text-center text-indigo-400">
          🏁 Active Rounds
        </h1>

        {error && (
          <p className="text-center text-red-500">
            ⚠️ Unable to load active rounds: {error}
          </p>
        )}

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
        ) : (
          sorted.map(r => (
            <Card
              key={r.id}
              className="bg-slate-800 text-white shadow-lg rounded-xl mb-4"
            >
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Round #{r.id}</h2>
                  <p className="text-sm opacity-75">
                    {r.blanks} blank{r.blanks > 1 ? 's' : ''} • {r.poolCount} entr
                    {r.poolCount === 1 ? 'y' : 'ies'}
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
