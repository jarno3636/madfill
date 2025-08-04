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
  const [rounds, setRounds] = useState(null)
  const [search, setSearch] = useState('')
  const [sortOption, setSortOption] = useState('timeAsc')

  useEffect(() => {
    ;(async () => {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const ct       = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        provider
      )

      // 1) fetch all Started events
      const startedEvs = await ct.queryFilter(ct.filters.Started(), 0, 'latest')
      const now        = Math.floor(Date.now() / 1000)

      // 2) fetch all Paid events to tally pool sizes
      const paidEvs    = await ct.queryFilter(ct.filters.Paid(), 0, 'latest')
      const poolCounts = paidEvs.reduce((acc, e) => {
        const id = e.args.id.toNumber()
        acc[id] = (acc[id] || 0) + 1
        return acc
      }, {})

      // 3) map + filter open rounds
      const openRounds = startedEvs
        .map(e => ({
          id:         e.args.id.toNumber(),
          blanks:     e.args.blanks.toNumber(),
          deadline:   e.args.deadline.toNumber(),
          poolCount:  poolCounts[e.args.id.toNumber()] || 0,
        }))
        .filter(r => r.deadline > now)

      setRounds(openRounds)
    })().catch(console.error)
  }, [])

  // Apply search
  const filtered = (rounds || []).filter(r =>
    search === '' || String(r.id).includes(search.trim())
  )

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortOption === 'timeAsc')   return a.deadline - b.deadline
    if (sortOption === 'timeDesc')  return b.deadline - a.deadline
    if (sortOption === 'poolAsc')   return a.poolCount - b.poolCount
    if (sortOption === 'poolDesc')  return b.poolCount - a.poolCount
    return 0
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

        {/* Rounds List */}
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
                    {r.blanks} blank{r.blanks > 1 && 's'} &nbsp;|&nbsp; {r.poolCount} entry{r.poolCount !== 1 && 'ies'}
                  </p>
                </div>
                <Countdown targetTimestamp={r.deadline} />
              </CardHeader>

              <CardContent className="flex justify-between items-center">
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
