import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Head from 'next/head'
import abi from '../abi/FillInStoryV3_ABI.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Countdown } from '@/components/Countdown'
import Link from 'next/link'
import Image from 'next/image'
import { fetchFarcasterProfile } from '@/lib/neynar'
import { motion } from 'framer-motion'

export default function ActivePools() {
  const [rounds, setRounds] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [baseUsd, setBaseUsd] = useState(0)
  const [expanded, setExpanded] = useState({})
  const [likes, setLikes] = useState(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('madfillLikes') || '{}')
    }
    return {}
  })
  const roundsPerPage = 6

  const loadPrice = async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
      const json = await res.json()
      setBaseUsd(json.base?.usd || 0)
    } catch (e) {
      console.error('Failed to fetch BASE price', e)
    }
  }

  const loadRounds = async () => {
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
    const count = await ct.pool1Count()
    const now = Math.floor(Date.now() / 1000)
    const all = []

    for (let i = 1; i <= count; i++) {
      try {
        const info = await ct.getPool1Info(BigInt(i))
        const name = info[0]
        const theme = info[1]
        const parts = info[2]
        const feeBase = Number(info[3]) / 1e18
        const deadline = Number(info[4])
        const participants = info[6]
        const claimed = info[8]
        const poolBalance = Number(info[9]) / 1e18

        if (!claimed && deadline > now) {
          const avatars = await Promise.all(participants.map(async (addr) => {
            const res = await fetchFarcasterProfile(addr)
            return {
              address: addr,
              avatar: res?.pfp_url || '/Capitalize.PNG',
              fallbackUsername: res?.username || addr.slice(2, 6).toUpperCase()
            }
          }))

          const submissions = await Promise.all(participants.map(async (addr) => {
            try {
              const [username, word] = await ct.getPool1Submission(i, addr)
              return { address: addr, username, word }
            } catch {
              return { address: addr, username: '', word: '' }
            }
          }))

          const poolUsd = poolBalance * baseUsd

          all.push({
            id: i,
            name: name || 'Untitled',
            theme,
            parts,
            feeBase: feeBase.toFixed(4),
            deadline,
            count: participants.length,
            usd: poolUsd.toFixed(2),
            participants: avatars,
            submissions,
            badge: deadline - now < 3600 ? '🔥 Ends Soon' : poolUsd > 5 ? '💰 Top Pool' : null,
            emoji: ['🐸', '🦊', '🦄', '🐢', '🐙'][i % 5]
          })
        }
      } catch (e) {
        console.warn(`Error loading round ${i}`, e)
      }
    }

    setRounds(all)
  }

  useEffect(() => {
    loadPrice()
    loadRounds()
    const interval = setInterval(() => {
      loadPrice()
      loadRounds()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, sortBy, filter])

  const handleLike = (roundId, submissionIdx) => {
    const key = `${roundId}-${submissionIdx}`
    const updated = { ...likes, [key]: !likes[key] }
    setLikes(updated)
    localStorage.setItem('madfillLikes', JSON.stringify(updated))
  }

  const filtered = rounds.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unclaimed') ||
      (filter === 'high' && parseFloat(r.usd) >= 5)
    return matchesSearch && matchesFilter
  })

  const sorted = filtered.sort((a, b) => {
    if (sortBy === 'deadline') return a.deadline - b.deadline
    if (sortBy === 'participants') return b.count - a.count
    if (sortBy === 'prize') return b.usd - a.usd
    return b.id - a.id
  })

  const totalPages = Math.ceil(sorted.length / roundsPerPage)
  const paginated = sorted.slice((page - 1) * roundsPerPage, page * roundsPerPage)

  return (
    <Layout>
      <Head>
        <title>MadFill – Active Rounds</title>
      </Head>
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-4xl font-extrabold text-white drop-shadow">🧠 Active Rounds</h1>

        <div className="flex flex-wrap justify-between gap-4 text-white">
          <input
            type="text"
            placeholder="🔍 Search by name..."
            className="w-full sm:w-1/3 p-2 bg-slate-900 border border-slate-700 rounded"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="p-2 bg-slate-900 border border-slate-700 rounded" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="newest">📅 Newest</option>
            <option value="deadline">⏳ Ending Soon</option>
            <option value="participants">👥 Most Participants</option>
            <option value="prize">💰 Prize Pool</option>
          </select>
          <select className="p-2 bg-slate-900 border border-slate-700 rounded" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">🌐 All</option>
            <option value="unclaimed">🪙 Unclaimed Only</option>
            <option value="high">💰 High Pools ($5+)</option>
          </select>
        </div>

        {paginated.length === 0 ? (
          <div className="text-white mt-8 text-lg text-center space-y-3">
            <p>No active rounds right now. Be the first to start one! 🚀</p>
            <Link href="/">
              <Button className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg">➕ Create New Round</Button>
            </Link>
          </div>
        ) : (
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {paginated.map(r => (
              <Card key={r.id} className="relative bg-gradient-to-br from-slate-800 to-slate-900 text-white border border-slate-700 rounded-xl hover:shadow-xl transition-all duration-300">
                <CardHeader className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{r.emoji}</div>
                    <div>
                      <h2 className="text-lg font-bold">#{r.id} — {r.name}</h2>
                      {r.badge && <span className="text-sm text-yellow-400 animate-pulse font-semibold">{r.badge}</span>}
                      <p className="text-xs text-slate-400 mt-1">Theme: {r.theme}</p>
                    </div>
                  </div>
                  <div className="text-sm font-mono mt-1">
                    <Countdown targetTimestamp={r.deadline} />
                  </div>
                </CardHeader>

                <CardContent className="space-y-2 text-sm font-medium">
                  <p><strong>Entry Fee:</strong> {r.feeBase} BASE</p>
                  <p><strong>Participants:</strong> {r.count}</p>
                  <p><strong>Total Pool:</strong> ${r.usd}</p>

                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                    className="text-indigo-400 text-xs underline"
                  >
                    {expanded[r.id] ? 'Hide Entries' : 'Show Entries'}
                  </button>

                  {expanded[r.id] && (
                    <div className="bg-slate-700 p-2 rounded text-xs font-mono text-slate-200 max-h-48 overflow-y-auto space-y-2">
                      {r.submissions.map((s, idx) => {
                        const p = r.participants.find(p => p.address === s.address)
                        const likeKey = `${r.id}-${idx}`
                        const words = s.word?.split(',').map(w => w.trim()) || []
                        return (
                          <div key={idx} className="flex items-start gap-2">
                            <Image
                              src={p?.avatar || '/Capitalize.PNG'}
                              alt={s.username || p?.fallbackUsername}
                              width={24}
                              height={24}
                              className="rounded-full border border-white mt-1"
                            />
                            <div className="flex-1">
                              <p className="text-slate-400 text-xs font-semibold">@{s.username || p?.fallbackUsername}</p>
                              <p>
                                {r.parts.map((part, i) => (
                                  <span key={i}>
                                    {part}
                                    <span className="text-yellow-300 font-bold ml-1 mr-1">
                                      {words[i] || '____'}
                                    </span>
                                  </span>
                                ))}
                              </p>
                            </div>
                            <button
                              onClick={() => handleLike(r.id, idx)}
                              className="text-pink-400 text-sm ml-1"
                            >
                              {likes[likeKey] ? '❤️' : '🤍'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <Link href={`/round/${r.id}`}>
                    <Button className="mt-3 bg-indigo-600 hover:bg-indigo-500 w-full">✏️ Enter Round</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button key={i} className={`px-4 py-1 rounded-full ${page === i + 1 ? 'bg-indigo-600' : 'bg-slate-700'} text-sm`} onClick={() => setPage(i + 1)}>
                {i + 1}
              </Button>
            ))}
          </div>
        )}
      </main>
    </Layout>
  )
}
