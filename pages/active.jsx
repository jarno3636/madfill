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

export default function ActivePools() {
  const [rounds, setRounds] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const roundsPerPage = 6

  const loadRounds = async () => {
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)

    const basePriceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
    const basePriceJson = await basePriceRes.json()
    const basePrice = basePriceJson.base?.usd || 0

    const count = await ct.pool1Count()
    const now = Math.floor(Date.now() / 1000)
    const all = []

    for (let i = 1; i <= count; i++) {
      try {
        const info = await ct.getPool1Info(BigInt(i))
        const name = info[0]
        const feeBase = Number(info[3]) / 1e18
        const deadline = Number(info[4])
        const participants = info[6]
        const claimed = info[8]

        if (!claimed && deadline > now) {
          const avatars = await Promise.all(
            participants.slice(0, 5).map(async (addr) => {
              const res = await fetchFarcasterProfile(addr)
              return {
                address: addr,
                avatar: res?.pfp_url || `https://effigy.im/a/${addr.toLowerCase()}`,
                username: res?.username || addr.slice(2, 6).toUpperCase()
              }
            })
          )

          const poolUsd = basePrice * participants.length * feeBase

          all.push({
            id: i,
            name: name || 'Untitled',
            feeBase: feeBase.toFixed(4),
            deadline,
            count: participants.length,
            usd: poolUsd.toFixed(2),
            participants: avatars,
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
    loadRounds()
    const interval = setInterval(loadRounds, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, sortBy, filter])

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
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold text-white">🌟 Active Rounds</h1>

        <div className="flex flex-wrap justify-between gap-4 text-white">
          <input
            type="text"
            placeholder="🔍 Search by name..."
            className="w-full sm:w-1/3 p-2 bg-slate-900 border border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="p-2 bg-slate-900 border border-slate-700 rounded"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="newest">📅 Newest</option>
            <option value="deadline">⏳ Ending Soon</option>
            <option value="participants">👥 Most Participants</option>
            <option value="prize">💰 Prize Pool</option>
          </select>
          <select
            className="p-2 bg-slate-900 border border-slate-700 rounded"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">🌐 All</option>
            <option value="unclaimed">🪙 Unclaimed Only</option>
            <option value="high">💰 High Pools ($5+)</option>
          </select>
        </div>

        {paginated.length === 0 ? (
          <p className="text-white mt-4">No active rounds right now. Be the first to start one!</p>
        ) : (
          paginated.map(r => (
            <Card key={r.id} className="bg-slate-800 text-white shadow-md hover:shadow-indigo-500/40 transition-shadow rounded-lg">
              <CardHeader className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{r.emoji}</div>
                  <div>
                    <h2 className="text-xl font-semibold">#{r.id} — {r.name}</h2>
                    {r.badge && <span className="text-sm text-yellow-400 animate-pulse">{r.badge}</span>}
                  </div>
                </div>
                <Countdown deadline={r.deadline} />
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Entry Fee:</strong> {r.feeBase} BASE</p>
                <p><strong>Participants:</strong> {r.count}</p>
                <p><strong>Total Pool (est.):</strong> ${r.usd}</p>
                <div className="flex -space-x-2">
                  {r.participants.map((p, i) => (
                    <Image
                      key={i}
                      src={p.avatar}
                      alt={p.username}
                      title={`@${p.username}`}
                      width={32}
                      height={32}
                      className="rounded-full border border-white"
                    />
                  ))}
                </div>
                <Link href={`/round/${r.id}`}>
                  <Button className="mt-3 bg-indigo-600 hover:bg-indigo-500 w-full">Enter Round</Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button
                key={i}
                className={`px-4 py-1 ${page === i + 1 ? 'bg-indigo-600' : 'bg-slate-700'} text-sm`}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        )}
      </main>
    </Layout>
  )
}
