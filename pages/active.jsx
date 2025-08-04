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

  useEffect(() => {
    ;(async () => {
      try {
        // CONFIG
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS!
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL!
        const provider = new ethers.FallbackProvider([
          new ethers.JsonRpcProvider(rpcUrl),
          new ethers.JsonRpcProvider('https://mainnet.base.org'),
        ])
        const ct = new ethers.Contract(address, abi, provider)

        // BLOCK RANGE
        const latestBlock = await provider.getBlockNumber()
        const fromBlockEnv = Number(process.env.NEXT_PUBLIC_START_BLOCK)
        const fromBlock = fromBlockEnv > 0 ? fromBlockEnv : 33631502
        const batchSize = 500

        // BATCH‐FETCH HELPER
        async function fetchEvents(filter: ethers.EventFilter) {
          let all: Array<ethers.Log & { args: any }> = []
          for (let start = fromBlock; start <= latestBlock; start += batchSize) {
            const end = Math.min(start + batchSize - 1, latestBlock)
            const logs = await provider.getLogs({
              address, topics: filter.topics, fromBlock: start, toBlock: end
            })
            const parsed = logs.map(log => ct.interface.parseLog(log).args)
            all = all.concat(parsed.map(args => ({ ...log, args })))
          }
          return all
        }

        // PULL EVENTS
        const startedEvs = await fetchEvents(ct.filters.Started())
        const paidEvs    = await fetchEvents(ct.filters.Paid())

        // POOL COUNTS
        const poolCounts = paidEvs.reduce<Record<number,number>>((acc, e) => {
          const id = Number(e.args.id)
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        // BUILD OPEN ROUNDS
        const now = Math.floor(Date.now() / 1000)
        const open = startedEvs
          .map(e => ({
            id:        Number(e.args.id),
            blanks:    Number(e.args.blanks),
            deadline:  Number(e.args.deadline),
            poolCount: poolCounts[Number(e.args.id)] || 0,
          }))
          .filter(r => r.deadline > now)

        setRounds(open)
      } catch (e) {
        console.error(e)
        setRounds([])
      }
    })()
  }, [])

  // FILTER & SORT
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

      <main className="max-w-5xl mx-auto p-6 space-y-8">

        {/* Page Title */}
        <h1 className="text-4xl font-extrabold text-center bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">
          🏁 Active Rounds
        </h1>

        {/* Search & Sort */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <input
            type="text"
            placeholder="🔍 Filter by Round ID"
            className="flex-1 bg-slate-900 text-white rounded-lg px-4 py-2 focus:outline-indigo-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="w-48 bg-slate-900 text-white rounded-lg px-4 py-2 focus:outline-indigo-500"
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
              <motion.div
                key={r.id}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="bg-slate-800 text-white rounded-xl shadow-lg overflow-hidden">
                  <CardHeader className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-semibold">#{r.id}</h2>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="inline-block bg-indigo-600 px-2 py-1 rounded-full text-xs font-medium">
                          {r.blanks} blank{r.blanks > 1 ? 's' : ''}
                        </span>
                        <span className="inline-block bg-emerald-600 px-2 py-1 rounded-full text-xs font-medium">
                          {r.poolCount} entr{r.poolCount === 1 ? 'y' : 'ies'}
                        </span>
                      </div>
                    </div>
                    <Countdown targetTimestamp={r.deadline} className="text-sm" />
                  </CardHeader>
                  <CardContent className="pt-2 flex justify-end">
                    <Link href={`/round/${r.id}`}>
                      <a className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium px-4 py-2 rounded-lg">
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
