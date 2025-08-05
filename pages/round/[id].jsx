// pages/active-rounds.jsx
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import { Alchemy, Network } from 'alchemy-sdk'
import abi from '../abi/FillInStoryFull.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function ActiveRoundsPage() {
  const [rounds, setRounds]         = useState(null)
  const [search, setSearch]         = useState('')
  const [sortOption, setSortOption] = useState('timeAsc')
  const [error, setError]           = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY
        const ADDRESS     = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        if (!ALCHEMY_KEY) throw new Error('Missing NEXT_PUBLIC_ALCHEMY_KEY')
        if (!ADDRESS)     throw new Error('Missing NEXT_PUBLIC_FILLIN_ADDRESS')

        // — initialize Alchemy (auto-paginates getLogs under the hood)
        const alchemy = new Alchemy({
          apiKey: ALCHEMY_KEY,
          network: Network.BASE
        })

        // — set up ethers.Contract just for decoding
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(ADDRESS, abi, provider)

        // — fetch all Started events
        const topicStarted = contract.interface.getEventTopic('Started')
        const startedLogs  = await alchemy.core.getLogs({
          fromBlock: Number(process.env.NEXT_PUBLIC_START_BLOCK) || 33631502,
          toBlock:   'latest',
          address:   ADDRESS,
          topics:    [topicStarted]
        })
        const startedArgs = startedLogs.map(log => contract.interface.parseLog(log).args)

        // — fetch all Paid events
        const topicPaid = contract.interface.getEventTopic('Paid')
        const paidLogs  = await alchemy.core.getLogs({
          fromBlock: Number(process.env.NEXT_PUBLIC_START_BLOCK) || 33631502,
          toBlock:   'latest',
          address:   ADDRESS,
          topics:    [topicPaid]
        })
        const paidArgs = paidLogs.map(log => contract.interface.parseLog(log).args)

        // — tally pools
        const poolCounts = paidArgs.reduce((acc, ev) => {
          const id = ev.id.toString()
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        // — build “open” rounds
        const now = Math.floor(Date.now()/1000)
        const openRounds = startedArgs
          .map(ev => {
            const id       = ev.id.toString()
            const blanks   = ev.blanks.toNumber()
            const deadline = ev.deadline.toNumber()
            return { id, blanks, deadline, poolCount: poolCounts[id] || 0 }
          })
          .filter(r => r.deadline > now)

        setRounds(openRounds)
      } catch (e) {
        console.error(e)
        setError('⚠️ Unable to load active rounds: ' + e.message)
        setRounds([])
      }
    })()
  }, [])

  // filter & sort
  const filtered = (rounds || []).filter(r =>
    !search || r.id.includes(search.trim())
  )
  const sorted = [...filtered].sort((a,b) => {
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

        {error && (
          <p className="text-center text-red-500">{error}</p>
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
