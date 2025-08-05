// pages/active‐rounds.jsx
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '../abi/FillInStoryFull.json'
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
        // 1) config
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL
        if (!address) throw new Error('Missing contract address')
        if (!rpcUrl)  throw new Error('Missing Alchemy URL')

        // 2) fallback provider (Alchemy + public Base)
        const alch    = new ethers.JsonRpcProvider(rpcUrl)
        const basePub = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const provider = new ethers.FallbackProvider([alch, basePub])
        const contract = new ethers.Contract(address, abi, provider)

        // 3) block range + batch size
        const latest     = await provider.getBlockNumber()
        const fromEnv    = Number(process.env.NEXT_PUBLIC_START_BLOCK) || 0
        const fromBlock  = fromEnv > 0 ? fromEnv : 33631502
        const BATCH_SIZE = 500

        // 4) helper to fetch & parse logs in chunks
        async function fetchArgs(filter) {
          let all = []
          for (let start = fromBlock; start <= latest; start += BATCH_SIZE) {
            const end = Math.min(start + BATCH_SIZE - 1, latest)
            const logs = await provider.getLogs({
              address,
              topics:   filter.topics,
              fromBlock: start,
              toBlock:   end
            })
            const parsed = logs.map(l => contract.interface.parseLog(l).args)
            all = all.concat(parsed)
          }
          return all
        }

        // 5) fetch Started() and Paid() args
        const [ started, paid ] = await Promise.all([
          fetchArgs(contract.filters.Started()),
          fetchArgs(contract.filters.Paid())
        ])

        // 6) tally pool sizes
        const poolCounts = paid.reduce((acc, ev) => {
          const id = Number(ev.id)
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        // 7) build “open” rounds list
        const now = Math.floor(Date.now() / 1000)
        const open = started
          .map(ev => ({
            id:        Number(ev.id),
            blanks:    Number(ev.blanks),
            deadline:  Number(ev.deadline),
            poolCount: poolCounts[Number(ev.id)] || 0
          }))
          .filter(r => r.deadline > now)

        setRounds(open)
      } catch (e) {
        console.error(e)
        setError(e.message || 'Could not load active rounds.')
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

        {error && (
          <p className="text-center text-red-500">⚠️ {error}</p>
        )}

        {rounds === null ? (
          <p className="text-center text-gray-500">Loading active rounds…</p>
        ) : rounds.length === 0 ? (
          <p className="text-center text-gray-500">No open rounds found.</p>
        ) : (
          rounds.map(r => (
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
