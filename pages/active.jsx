// pages/active‐rounds.jsx
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '../abi/FillInStoryFull.json'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { Button } from '@/components/ui/button'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function ActiveRoundsPage() {
  const [rounds, setRounds]       = useState(null)
  const [search, setSearch]       = useState('')
  const [sortOption, setSortOption] = useState('timeAsc')
  const [error, setError]         = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL
        if (!address || !rpcUrl) {
          throw new Error('Missing configuration for contract or RPC URL.')
        }

        const provider = new ethers.JsonRpcProvider(rpcUrl)
        const ct       = new ethers.Contract(address, abi, provider)

        const latestBlock = await provider.getBlockNumber()
        const fromBlock   = Number(process.env.NEXT_PUBLIC_START_BLOCK || 0)
        const chunkSize   = 500

        // helper to pull events in <=500-block slices
        async function fetchEvents(filter) {
          let all = []
          for (let start = fromBlock; start <= latestBlock; start += chunkSize) {
            const end = Math.min(start + chunkSize - 1, latestBlock)
            const seg = await ct.queryFilter(filter, start, end)
            all = all.concat(seg)
          }
          return all
        }

        // 1) Started events
        const startedEvs = await fetchEvents(ct.filters.Started())
        // 2) Paid events
        const paidEvs    = await fetchEvents(ct.filters.Paid())

        // count pool sizes
        const poolCounts = paidEvs.reduce((acc, e) => {
          const id = e.args.id.toNumber()
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        // map + filter open rounds
        const now = Math.floor(Date.now() / 1000)
        const openRounds = startedEvs
          .map(e => {
            const id       = e.args.id.toNumber()
            const blanks   = e.args.blanks.toNumber()
            const deadline = e.args.deadline.toNumber()
            return { id, blanks, deadline, poolCount: poolCounts[id] || 0 }
          })
          .filter(r => r.deadline > now)

        setRounds(openRounds)
      } catch (err) {
        console.error('ActiveRounds load error:', err)
        setError('⚠️ Unable to load active rounds right now. Please try again shortly.')
        setRounds([])   // so UI moves past the “loading” state
      }
    })()
  }, [])

  // apply search + sort
  const filtered = (rounds || []).filter(r =>
    !search || String(r.id).includes(search.trim())
  )
  const sorted = [...filtered].sort((a, b) => {
    switch (sortOption) {
      case 'timeAsc':  return a.deadline  - b.deadline
      case 'timeDesc': return b.deadline  - a.deadline
      case 'poolAsc':  return a.poolCount - b.poolCount
      case 'poolDesc': return b.poolCount - a.poolCount
      default:         return 0
    }
  })

  return (
    <Layout>
      <Head><title>MadFill • Active Rounds</title></Head>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-3xl font-extrabold text-center text-indigo-400">
          🏁 Active Rounds
        </h1>

        {/* Search & Sort */}
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
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

        {/* Error banner */}
        {error && (
          <p className="text-center text-red-400">{error}</p>
        )}

        {/* Rounds List */}
        {rounds === null ? (
          <p className="text-center text-slate-400">Loading active rounds…</p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-slate-400">
            {error
              ? '—'
              : 'No open rounds found.'}
          </p>
        ) : (
          sorted.map(r => (
            <Card
              key={r.id}
              className="bg-slate-800 text-white shadow-lg rounded-xl"
            >
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Round #{r.id}</h2>
                  <p className="text-sm opacity-75">
                    {r.blanks} blank{r.blanks > 1 && 's'} • {r.poolCount}{' '}
                    entr{r.poolCount === 1 ? 'y' : 'ies'}
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
