// pages/active.jsx
import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Head from 'next/head'
import abi from '../abi/FillInStoryV2_ABI.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Countdown } from '@/components/Countdown'
import Link from 'next/link'
import Image from 'next/image'

export default function ActivePools() {
  const [rounds, setRounds] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const roundsPerPage = 6

  useEffect(() => {
    const loadRounds = async () => {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)

      const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
      const basePrice = (await priceRes.json()).base.usd

      const count = await ct.pool1Count()
      const all = []

      for (let i = 0; i < count; i++) {
        try {
          const info = await ct.getPool1Info(i)
          const deadline = Number(info.deadline)
          const now = Math.floor(Date.now() / 1000)

          if (!info.claimed && deadline > now) {
            const poolUsd = Number(info.feeUsd) * info.participants.length
            all.push({
              id: i,
              name: localStorage.getItem(`madfill-roundname-${i}`) || info.name || 'Untitled',
              feeUsd: Number(info.feeUsd),
              feeBase: (Number(info.feeUsd) / basePrice).toFixed(4),
              deadline,
              participants: info.participants,
              count: info.participants.length,
              usd: poolUsd.toFixed(2),
              badge: deadline - now < 3600 ? '🔥 Ends Soon' : poolUsd > 10 ? '💰 Top Pool' : null,
              thumbnail: `/thumbnails/thumb${i % 5}.jpg`, // mock images cycle
            })
          }
        } catch (e) {
          console.warn(`Error loading round ${i}`, e)
        }
      }

      setRounds(all)
    }

    loadRounds()
  }, [])

  const filtered = rounds.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unclaimed' && !r.claimed) ||
      (filter === 'high' && parseFloat(r.usd) >= 5)
    return matchesSearch && matchesFilter
  })

  const sorted = filtered.sort((a, b) => {
    if (sortBy === 'deadline') return a.deadline - b.deadline
    if (sortBy === 'participants') return b.count - a.count
    return b.id - a.id
  })

  const paginated = sorted.slice((page - 1) * roundsPerPage, page * roundsPerPage)

  return (
    <Layout>
      <Head>
        <title>MadFill – Active Rounds</title>
      </Head>
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-white">🔥 Active Rounds</h1>

        <div className="flex flex-wrap justify-between gap-4 text-white">
          <input
            type="text"
            placeholder="🔍 Search by name..."
            className="w-full sm:w-1/3 p-2 bg-slate-900 border rounded"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="p-2 bg-slate-900 border rounded"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="newest">📅 Newest</option>
            <option value="deadline">⏳ Ending Soon</option>
            <option value="participants">👥 Most Participants</option>
          </select>
          <select
            className="p-2 bg-slate-900 border rounded"
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
            <Card key={r.id} className="bg-slate-800 text-white shadow rounded-lg">
              <CardHeader className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Image
                    src={r.thumbnail}
                    alt="Thumbnail"
                    width={50}
                    height={50}
                    className="rounded-full"
                  />
                  <div>
                    <h2 className="text-xl font-semibold">#{r.id} — {r.name}</h2>
                    {r.badge && <span className="text-sm text-yellow-400">{r.badge}</span>}
                  </div>
                </div>
                <Countdown deadline={r.deadline} />
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Fee:</strong> ~${r.feeUsd.toFixed(2)} USD ({r.feeBase} BASE)</p>
                <p><strong>Participants:</strong> {r.count}</p>
                <p><strong>Total Pool:</strong> ${r.usd}</p>
                <div className="flex -space-x-2">
                  {r.participants.slice(0, 5).map((p, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center border border-white">
                      {p.slice(2, 4).toUpperCase()}
                    </div>
                  ))}
                </div>
                <Link href={`/round/${r.id}`}>
                  <Button className="mt-2 bg-indigo-600 hover:bg-indigo-500">Enter Round</Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}

        {sorted.length > roundsPerPage && (
          <div className="flex justify-center gap-4 mt-6">
            {Array.from({ length: Math.ceil(sorted.length / roundsPerPage) }).map((_, i) => (
              <Button
                key={i}
                className={`px-4 ${page === i + 1 ? 'bg-indigo-600' : 'bg-slate-700'}`}
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
