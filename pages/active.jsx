// pages/active‐rounds.jsx
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import { motion } from 'framer-motion'
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
  const [error, setError]           = useState('')

  useEffect(() => {
    (async () => {
      try {
        // ── 1) CONFIG ─────────────────────────────────────────────────────────
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL
        if (!address) throw new Error('Missing NEXT_PUBLIC_FILLIN_ADDRESS')
        if (!rpcUrl)   throw new Error('Missing NEXT_PUBLIC_ALCHEMY_URL')

        // ── 2) FALLBACK PROVIDER ────────────────────────────────────────────
        const fallback = new ethers.FallbackProvider([
          new ethers.JsonRpcProvider(rpcUrl),                  // Alchemy
          new ethers.JsonRpcProvider('https://mainnet.base.org') // Base RPC
        ])

        // ── 3) FETCH BLOCK RANGE ─────────────────────────────────────────────
        const latestBlock = await fallback.getBlockNumber()
        const fromEnv     = Number(process.env.NEXT_PUBLIC_START_BLOCK) || 0
        const fromBlock   = fromEnv > 0 ? fromEnv : 33631502

        // ── 4) HELPER TO GET & PARSE LOGS ───────────────────────────────────
        async function loadArgs(filter) {
          const logs = await fallback.getLogs({
            address,
            topics:  filter.topics,
            fromBlock,
            toBlock: latestBlock
          })
          return logs.map(l => ethers.utils.defaultAbiCoder
            .decode(
              filter.fragment.inputs.map(i => i.type),
              // slice off the first topic (signature) and read `data`
              ethers.utils.hexConcat([l.data, ...l.topics.slice(1)])
            )
            // decode returns an array; we need named values, so re-parse via interface:
            .map((_, i) => {
              // we only really care about positional: we'll re-parse fully:
              // simpler: use interface.parseLog
              return null
            })
          )
        }

        // Actually, it's much simpler to re-parse each log via the contract interface:
        const contract = new ethers.Contract(address, abi, fallback)
        async function parseArgs(filter) {
          const logs = await fallback.getLogs({
            address,
            topics:  filter.topics,
            fromBlock,
            toBlock: latestBlock
          })
          return logs.map(l => contract.interface.parseLog(l).args)
        }

        // ── 5) PULL BOTH EVENTS ───────────────────────────────────────────────
        const startedArgs = await parseArgs(contract.filters.Started())
        const paidArgs    = await parseArgs(contract.filters.Paid())

        // ── 6) TALLY POOLS & BUILD OPEN ROUNDS ───────────────────────────────
        const poolCounts = paidArgs.reduce((acc, ev) => {
          const id = Number(ev.id)
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        const now = Math.floor(Date.now() / 1000)
        const openRounds = startedArgs
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

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <h1 className="text-4xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
          🏁 Active Rounds
        </h1>

        {error && (
          <p className="text-center text-red-500">
            ⚠️ Unable to load active rounds: {error}
          </p>
        )}

        {/* Search & Sort */}
        <div className="flex flex-col md:flex-row gap-4">
          <input
            className="flex-1 bg-slate-900 text-white rounded-lg px-4 py-2"
            placeholder="🔍 Filter by Round ID"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="w-48 bg-slate-900 text-white rounded-lg px-4 py-2"
            value={sortOption}
            onChange={e => setSortOption(e.target.value)}
          >
            <option value="timeAsc">⏱️ Time ↑</option>
            <option value="timeDesc">⏱️ Time ↓</option>
            <option value="poolAsc">💰 Pool ↑</option>
            <option value="poolDesc">💰 Pool ↓</option>
          </select>
        </div>

        {/* Rounds Grid */}
        {rounds === null ? (
          <p className="text-center text-slate-400">Loading active rounds…</p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-slate-400">No open rounds found.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {sorted.map(r => (
              <motion.div key={r.id} whileHover={{ scale:1.02 }} transition={{ duration:0.2 }}>
                <Card className="bg-slate-800 text-white rounded-xl shadow-lg overflow-hidden">
                  <CardHeader className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-semibold">#{r.id}</h2>
                      <div className="mt-1 flex gap-2">
                        <span className="bg-indigo-600 px-2 py-1 rounded-full text-xs">
                          {r.blanks} blank{r.blanks>1?'s':''}
                        </span>
                        <span className="bg-emerald-600 px-2 py-1 rounded-full text-xs">
                          {r.poolCount} entr{r.poolCount===1?'y':'ies'}
                        </span>
                      </div>
                    </div>
                    <Countdown targetTimestamp={r.deadline} className="text-sm" />
                  </CardHeader>
                  <CardContent className="flex justify-end">
                    <Link href={`/round/${r.id}`}>
                      <a className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 rounded-lg">
                        View & Enter
                      </a>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </Layout>
  )
}
