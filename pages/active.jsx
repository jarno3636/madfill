// pages/active-rounds.jsx
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryFull.json'
import { categories } from '@/data/templates'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function ActiveRoundsPage() {
  const [rounds, setRounds] = useState(null)
  const [error,  setError]  = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL
        const entryFee = Number(process.env.NEXT_PUBLIC_ENTRY_FEE) || 0.001

        if (!address || !rpcUrl) throw new Error('Missing config')

        const alch    = new ethers.JsonRpcProvider(rpcUrl)
        const base    = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const provider = new ethers.FallbackProvider([alch, base])
        const contract = new ethers.Contract(address, abi, provider)

        const latest     = await provider.getBlockNumber()
        const fromBlock  = Number(process.env.NEXT_PUBLIC_START_BLOCK) || 33631502
        const BATCH_SIZE = 500

        async function fetchAllArgs(eventFilter) {
          let all = []
          for (let start = fromBlock; start <= latest; start += BATCH_SIZE) {
            const end = Math.min(start + BATCH_SIZE - 1, latest)
            const logs = await provider.getLogs({ address, topics: eventFilter.topics, fromBlock: start, toBlock: end })
            const parsed = logs.map(l => contract.interface.parseLog(l).args)
            all.push(...parsed)
          }
          return all
        }

        const [started, paid] = await Promise.all([
          fetchAllArgs(contract.filters.Started()),
          fetchAllArgs(contract.filters.Paid())
        ])

        const poolCounts = paid.reduce((m, ev) => {
          const id = Number(ev.id)
          m[id] = (m[id] || 0) + 1
          return m
        }, {})

        const now = Math.floor(Date.now() / 1000)
        const open = started
          .map(ev => {
            const id = Number(ev.id)
            const blanks = Number(ev.blanks)
            const deadline = Number(ev.deadline)
            const cat = Number(ev.cat || 0)
            const tpl = Number(ev.tpl || 0)
            const card = categories?.[cat]?.templates?.[tpl]
            return {
              id,
              blanks,
              deadline,
              poolCount: poolCounts[id] || 0,
              cardTitle: card?.title || 'Untitled',
              cardPreview: card?.parts?.slice(0, 2)?.join('____') || 'No preview'
            }
          })
          .filter(r => r.deadline > now)

        setRounds(open)
      } catch (e) {
        console.error(e)
        setError(e.message || 'Failed to load rounds')
        setRounds([])
      }
    })()
  }, [])

  return (
    <Layout>
      <Head><title>MadFill • Active Rounds</title></Head>
      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-3xl font-extrabold text-center text-indigo-400">
          🏁 Active Rounds
        </h1>

        {error && <p className="text-center text-red-500">⚠️ {error}</p>}

        {rounds === null ? (
          <p className="text-center text-gray-500">Loading active rounds…</p>
        ) : rounds.length === 0 ? (
          <p className="text-center text-gray-500">No open rounds found.</p>
        ) : (
          rounds.map(r => (
            <Card key={r.id} className="bg-slate-800 text-white rounded-lg shadow mb-4">
              <CardHeader className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">#{r.id} — {r.cardTitle}</h2>
                  <p className="text-sm opacity-80 mb-1 italic">“{r.cardPreview}…”</p>
                  <p className="text-sm text-indigo-300">
                    {r.blanks} blank{r.blanks > 1 ? 's' : ''} • {r.poolCount} entr{r.poolCount === 1 ? 'y' : 'ies'} • 💰 {(r.poolCount * 0.001).toFixed(3)} BASE
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
