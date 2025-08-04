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
  const [rounds, setRounds]     = useState(null)
  const [search, setSearch]     = useState('')
  const [sortOption, setSort]   = useState('timeAsc')
  const [error, setError]       = useState('')

  useEffect(() => {
    (async () => {
      try {
        // — CONFIG —
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL
        if (!address || !rpcUrl) throw new Error('Missing address or Alchemy URL')

        // — PROVIDERS —
        const alchemy = new ethers.JsonRpcProvider(rpcUrl)
        const fallback= new ethers.JsonRpcProvider('https://mainnet.base.org')
        const provider= new ethers.FallbackProvider([alchemy, fallback])
        const contract= new ethers.Contract(address, abi, provider)

        // — BLOCK WINDOW & CHUNKING —
        const latest = await provider.getBlockNumber()
        const windowSize = 200_000    // scan just last ~week
        const startBlock = Math.max(latest - windowSize, 0)
        const chunkSize  = 500        // ≤500 blocks/chunk

        // — RETRYABLE getLogs helper —
        async function safeGetLogs(opts, retries = 3) {
          try {
            return await alchemy.getLogs(opts)
          } catch (e) {
            if (retries > 0 && /rate limit|over rate limit/i.test(e.message)) {
              // wait a bit then retry
              await new Promise(r => setTimeout(r, 1000))
              return safeGetLogs(opts, retries - 1)
            }
            // fallback to public node for this chunk
            return fallback.getLogs(opts)
          }
        }

        // — FETCH & PARSE in CHUNKS —
        async function fetchLogs(filter) {
          const all = []
          for (let b = startBlock; b <= latest; b += chunkSize) {
            const to = Math.min(b + chunkSize - 1, latest)
            const logs = await safeGetLogs({
              address,
              topics: filter.topics,
              fromBlock: b,
              toBlock:   to,
            })
            for (const l of logs) {
              all.push(contract.interface.parseLog(l).args)
            }
          }
          return all
        }

        // — PULL EVENTS —
        const started = await fetchLogs(contract.filters.Started())
        const paid    = await fetchLogs(contract.filters.Paid())

        // — TALLY POOLS & BUILD ROUNDS —
        const pool = {}
        paid.forEach(ev => {
          const id = Number(ev.id)
          pool[id] = (pool[id] || 0) + 1
        })

        const now = Math.floor(Date.now()/1000)
        const open = started
          .map(ev => ({
            id: Number(ev.id),
            blanks: Number(ev.blanks),
            deadline: Number(ev.deadline),
            poolCount: pool[Number(ev.id)] || 0,
          }))
          .filter(r => r.deadline > now)

        setRounds(open)
      } catch (e) {
        console.error(e)
        setError(e.message || 'Load failed')
        setRounds([])
      }
    })()
  }, [])

  // FILTER & SORT
  const filtered = (rounds||[]).filter(r =>
    !search || String(r.id).includes(search.trim())
  )
  const sorted = [...filtered].sort((a,b)=>{
    switch(sortOption) {
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

        <h1 className="text-4xl font-extrabold text-center text-indigo-500">
          🏁 Active Rounds
        </h1>

        {error && (
          <p className="text-center text-red-600">
            ⚠ Unable to load active rounds: {error}
          </p>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <input
            className="flex-1 bg-slate-900 text-white rounded-lg px-4 py-2"
            placeholder="🔍 Filter by Round ID"
            value={search}
            onChange={e=>setSearch(e.target.value)}
          />
          <select
            className="w-48 bg-slate-900 text-white rounded-lg px-4 py-2"
            value={sortOption}
            onChange={e=>setSort(e.target.value)}
          >
            <option value="timeAsc">⏱ Time ↑</option>
            <option value="timeDesc">⏱ Time ↓</option>
            <option value="poolAsc">💰 Pool ↑</option>
            <option value="poolDesc">💰 Pool ↓</option>
          </select>
        </div>

        {rounds===null
          ? <p className="text-center text-slate-400">Loading active rounds…</p>
          : sorted.length===0
            ? <p className="text-center text-slate-400">No open rounds found.</p>
            : (
              <div className="grid sm:grid-cols-2 gap-6">
                {sorted.map(r=>(
                  <motion.div key={r.id} whileHover={{scale:1.02}} transition={{duration:0.2}}>
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
                        <Countdown targetTimestamp={r.deadline} />
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
            )
        }
      </main>
      <Footer/>
    </Layout>
  )
}
