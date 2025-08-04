// pages/active-rounds.jsx
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import Link from 'next/link'
import abi from '@/abi/FillInStoryFull.json'

export default function ActiveRoundsPage() {
  const [rounds, setRounds] = useState(null)
  const [error, setError]   = useState('')
  const [search, setSearch] = useState('')
  const [sortOption, setSortOption] = useState('timeAsc')

  useEffect(() => {
    ;(async () => {
      try {
        const API_KEY = process.env.NEXT_PUBLIC_BASESCAN_API_KEY
        const ADDRESS = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const FROM    = process.env.NEXT_PUBLIC_START_BLOCK || '33631502'

        if (!API_KEY) throw new Error('Missing BaseScan API key')
        if (!ADDRESS) throw new Error('Missing contract address')

        // prepare ABI parser
        const iface = new ethers.Interface(abi)

        async function fetchLogs(topic0) {
          const qs = new URLSearchParams({
            module:    'logs',
            action:    'getLogs',
            fromBlock: FROM,
            toBlock:   'latest',
            address:   ADDRESS,
            topic0,
            apikey:    API_KEY,
          })
          const resp = await fetch(`https://api.basescan.org/api?${qs}`)
          const data = await resp.json()
          if (data.status !== '1') {
            throw new Error(data.message || 'no logs returned')
          }
          // parse each log entry
          return data.result.map(log =>
            iface.parseLog({ topics: log.topics, data: log.data }).args
          )
        }

        // pull both started & paid
        const [startedArgs, paidArgs] = await Promise.all([
          fetchLogs(iface.getEventTopic('Started')),
          fetchLogs(iface.getEventTopic('Paid'))
        ])

        // tally pool sizes
        const poolCounts = paidArgs.reduce((acc, ev) => {
          const id = Number(ev.id)
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        // build our open‐round list
        const now = Math.floor(Date.now() / 1000)
        const openRounds = startedArgs
          .map(ev => ({
            id:        Number(ev.id),
            blanks:    Number(ev.blanks),
            deadline:  Number(ev.deadline),
            poolCount: poolCounts[Number(ev.id)] || 0,
          }))
          .filter(r => r.deadline > now)

        setRounds(openRounds)
      } catch (e) {
        console.error(e)
        setError('⚠️ Unable to load active rounds: ' + e.message)
        setRounds([])
      }
    })()
  }, [])

  // filter & sort in‐memory
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

        {error && (
          <p className="text-red-500 text-center">{error}</p>
        )}

        {/* search & sort */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <input
            type="text"
            placeholder="🔍 Filter by Round ID"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-slate-900 text-white rounded px-3 py-2"
          />
          <select
            value={sortOption}
            onChange={e => setSortOption(e.target.value)}
            className="bg-slate-900 text-white rounded px-3 py-2"
          >
            <option value="timeAsc">⏱️ Time ↑</option>
            <option value="timeDesc">⏱️ Time ↓</option>
            <option value="poolAsc">💰 Pool ↑</option>
            <option value="poolDesc">💰 Pool ↓</option>
          </select>
        </div>

        {/* content */}
        {rounds === null ? (
          <p className="text-center text-gray-500">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-gray-500">No open rounds found.</p>
        ) : (
          sorted.map(r => (
            <Card key={r.id} className="bg-slate-800 text-white rounded-lg shadow">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl">Round #{r.id}</h2>
                  <p className="text-sm opacity-75">
                    {r.blanks} blank{r.blanks > 1 ? 's' : ''} • {r.poolCount} entr{r.poolCount === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <Countdown targetTimestamp={r.deadline} />
              </CardHeader>
              <CardContent className="text-right">
                <Link href={`/round/${r.id}`}>
                  <a className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded">
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
