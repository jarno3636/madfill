import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryFull.json'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function ActiveRoundsPage() {
  const [rounds, setRounds] = useState(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL
        if (!address) throw new Error('Missing contract address')
        if (!rpcUrl)  throw new Error('Missing RPC URL')

        const alchProv = new ethers.JsonRpcProvider(rpcUrl)
        const baseProv = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const provider = new ethers.FallbackProvider([alchProv, baseProv])
        const contract = new ethers.Contract(address, abi, provider)

        const latest     = await provider.getBlockNumber()
        const fromBlock  = Number(process.env.NEXT_PUBLIC_START_BLOCK) || 33631502
        const BATCH_SIZE = 500

        async function fetchAllArgs(eventFilter) {
          let all = []
          for (let start = fromBlock; start <= latest; start += BATCH_SIZE) {
            const end = Math.min(start + BATCH_SIZE - 1, latest)
            const logs = await provider.getLogs({
              address,
              topics: eventFilter.topics,
              fromBlock: start,
              toBlock: end
            })
            all.push(...logs.map(l => contract.interface.parseLog(l).args))
          }
          return all
        }

        const [started, paid, named] = await Promise.all([
          fetchAllArgs(contract.filters.Started()),
          fetchAllArgs(contract.filters.Paid()),
          fetchAllArgs(contract.filters.Named?.() ?? { topics: [] })
        ])

        const poolCounts = paid.reduce((m, ev) => {
          const id = Number(ev.id)
          m[id] = (m[id] || 0) + 1
          return m
        }, {})

        const nameMap = named.reduce((m, ev) => {
          const id = Number(ev.id)
          m[id] = ev.name ? ethers.decodeBytes32String(ev.name) : ''
          return m
        }, {})

        const now = Math.floor(Date.now()/1000)
        const openRounds = started
          .map(ev => {
            const id = Number(ev.id)
            return {
              id,
              blanks: Number(ev.blanks),
              deadline: Number(ev.deadline),
              poolCount: poolCounts[id] || 0,
              name: nameMap[id] || `Round #${id}`
            }
          })
          .filter(r => r.deadline > now)

        setRounds(openRounds)
      } catch (e) {
        console.error(e)
        setError(e.message || 'Failed to load active rounds')
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
          <div className="grid sm:grid-cols-2 gap-6">
            {rounds.map(r => (
              <Card key={r.id} className="bg-slate-800 text-white rounded-lg shadow">
                <CardHeader className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold">{r.name}</h2>
                    <p className="text-sm opacity-75">
                      {r.blanks} blank{r.blanks > 1 ? 's' : ''} • {r.poolCount} entr{r.poolCount === 1 ? 'y' : 'ies'}
                    </p>
                  </div>
                  <Countdown targetTimestamp={r.deadline} />
                </CardHeader>
                <CardContent className="text-right">
                  <Link href={`/round/${r.id}`}>
                    <a className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded text-white font-semibold">
                      View & Enter
                    </a>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </Layout>
  )
}
