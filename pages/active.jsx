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

export default function ActivePools() {
  const [rounds, setRounds] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')

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
            all.push({
              id: i,
              name: localStorage.getItem(`madfill-roundname-${i}`) || info.name || 'Untitled',
              feeUsd: Number(info.feeUsd),
              feeBase: (Number(info.feeUsd) / basePrice).toFixed(4),
              deadline: deadline,
              participants: info.participants,
              count: info.participants.length,
              usd: (Number(info.feeUsd) * info.participants.length).toFixed(2)
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

  const filtered = rounds.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))

  const sorted = filtered.sort((a, b) => {
    if (sortBy === 'deadline') return a.deadline - b.deadline
    if (sortBy === 'participants') return b.count - a.count
    return b.id - a.id // newest
  })

  return (
    <Layout>
      <Head>
        <title>MadFill – Active Rounds</title>
      </Head>
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-white">🔥 Active Rounds</h1>

        <div className="flex flex-wrap justify-between gap-4 text-white">
          <input
            type="text"
            placeholder="🔍 Search by name..."
            className="w-full sm:w-1/2 p-2 bg-slate-900 border rounded"
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
        </div>

        {sorted.length === 0 ? (
          <p className="text-white mt-4">No active rounds right now. Be the first to start one!</p>
        ) : (
          sorted.map(r => (
            <Card key={r.id} className="bg-slate-800 text-white shadow rounded-lg">
              <CardHeader className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">#{r.id} — {r.name}</h2>
                <Countdown deadline={r.deadline} />
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Fee:</strong> ~${r.feeUsd.toFixed(2)} USD ({r.feeBase} BASE)</p>
                <p><strong>Participants:</strong> {r.count}</p>
                <p><strong>Total Pool:</strong> ${r.usd}</p>
                <Link href={`/round/${r.id}`}>
                  <Button className="mt-2 bg-indigo-600 hover:bg-indigo-500">Enter Round</Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </Layout>
  )
}
