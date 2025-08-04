// pages/active-rounds.jsx
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '../abi/FillInStoryFull.json'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { Button } from '@/components/ui/button'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'  // your shared footer
import Link from 'next/link'

export default function ActiveRoundsPage() {
  const [rounds, setRounds] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    ;(async () => {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const ct       = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        provider
      )

      // Fetch all Started events
      const events = await ct.queryFilter(ct.filters.Started(), 0, 'latest')
      const now    = Math.floor(Date.now() / 1000)

      // Map + filter
      const openRounds = events
        .map(e => ({
          id:        e.args.id.toNumber(),
          blanks:    e.args.blanks.toNumber(),
          deadline:  e.args.deadline.toNumber(),
        }))
        .filter(r => r.deadline > now)

      setRounds(openRounds)
    })().catch(console.error)
  }, [])

  const filtered = (rounds || []).filter(r =>
    search === '' || String(r.id).includes(search)
  )

  return (
    <Layout>
      <Head>
        <title>MadFill • Active Rounds</title>
      </Head>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-3xl font-bold text-center">🏁 Active Rounds</h1>

        {/* Search box */}
        <div className="flex justify-center">
          <input
            type="text"
            placeholder="Filter by Round ID…"
            className="w-1/3 bg-slate-900 text-white rounded px-3 py-2"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {rounds === null ? (
          <p className="text-center">Loading active rounds…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center">No open rounds match your filter.</p>
        ) : (
          filtered.map(r => (
            <Card key={r.id} className="bg-slate-800 text-white shadow-lg rounded-xl">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Round #{r.id}</h2>
                  <p className="text-sm opacity-75">{r.blanks} blank{r.blanks > 1 && 's'}</p>
                </div>
                <Countdown targetTimestamp={r.deadline} />
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                <Link href={`/round/${r.id}`}>
                  <a className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded">
                    View &amp; Enter
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
