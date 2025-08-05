import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryFull.json'
import { Countdown } from '@/components/Countdown'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { getBasePriceUSD } from '@/lib/getBasePrice'

export default function ActiveRoundsPage() {
  const [rounds, setRounds] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('timeAsc')
  const [basePrice, setBasePrice] = useState(0)

  useEffect(() => {
    ;(async () => {
      try {
        const address = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const rpcUrl  = process.env.NEXT_PUBLIC_ALCHEMY_URL
        if (!address || !rpcUrl) throw new Error('Missing env variables')

        const alchProv = new ethers.JsonRpcProvider(rpcUrl)
        const baseProv = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const provider = new ethers.FallbackProvider([alchProv, baseProv])
        const contract = new ethers.Contract(address, abi, provider)

        const latest     = await provider.getBlockNumber()
        const fromBlock  = Number(process.env.NEXT_PUBLIC_START_BLOCK) || 33631502
        const BATCH_SIZE = 500

        async function fetchAllArgs(filter) {
          let all = []
          for (let start = fromBlock; start <= latest; start += BATCH_SIZE) {
            const end = Math.min(start + BATCH_SIZE - 1, latest)
            const logs = await provider.getLogs({ address, topics: filter.topics, fromBlock: start, toBlock: end })
            all.push(...logs.map(log => contract.interface.parseLog(log).args))
          }
          return all
        }

        const [started, paid, named] = await Promise.all([
          fetchAllArgs(contract.filters.Started()),
          fetchAllArgs(contract.filters.Paid()),
          fetchAllArgs(contract.filters.Named?.() ?? { topics: [] }),
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

        const now = Math.floor(Date.now() / 1000)
        const openRounds = started
          .map(ev => {
            const id = Number(ev.id)
            return {
              id,
              blanks: Number(ev.blanks),
              deadline: Number(ev.deadline),
              poolCount: poolCounts[id] || 0,
              name: nameMap[id] || `Round #${id}`,
            }
          })
          .filter(r => r.deadline > now)

        const price = await getBasePriceUSD()
        setBasePrice(price)
        setRounds(openRounds)
      } catch (e) {
        console.error(e)
        setError(e.message || 'Failed to load active rounds')
        setRounds([])
      }
    })()
  }, [])

  const filtered = (rounds || []).filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'poolDesc') return b.poolCount - a.poolCount
    if (sort === 'poolAsc')  return a.poolCount - b.poolCount
    if (sort === 'timeDesc') return b.deadline - a.deadline
    return a.deadline - b.deadline
  })

  return (
    <Layout>
      <Head><title>MadFill • Active Rounds</title></Head>
      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <h1 className="text-3xl font-bold text-center text-indigo-400">🏁 Active Rounds</h1>

        {error && <p className="text-center text-red-500">⚠️ {error}</p>}

        <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
          <input
            className="w-full md:w-1/2 bg-slate-800 text-white px-3 py-2 rounded-md"
            placeholder="🔍 Search by name"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="bg-slate-800 text-white px-3 py-2 rounded-md"
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            <option value="timeAsc">⏱️ Time ↑</option>
            <option value="timeDesc">⏱️ Time ↓</option>
            <option value="poolAsc">💰 Entries ↑</option>
            <option value="poolDesc">💰 Entries ↓</option>
          </select>
        </div>

        {rounds === null ? (
          <p className="text-center text-gray-500">Loading active rounds…</p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-gray-500">No rounds match that filter.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {sorted.map(r => (
              <div key={r.id} className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-md p-5 border border-slate-700">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h2 className="text-lg font-semibold text-white truncate max-w-xs">{r.name}</h2>
                    <p className="text-sm text-slate-300">
                      📝 {r.blanks} blank{r.blanks > 1 ? 's' : ''}<br/>
                      👥 {r.poolCount} entr{r.poolCount === 1 ? 'y' : 'ies'}
                    </p>
                  </div>
                  <Countdown targetTimestamp={r.deadline} className="text-xs text-white" />
                </div>
                <div className="text-sm text-green-400 font-bold mb-3">
                  💰 ≈ ${(r.poolCount * 0.001 * basePrice).toFixed(2)} USD in pot
                </div>
                <div className="text-right">
                  <Link href={`/round/${r.id}`}>
                    <a className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold">
                      View & Enter
                    </a>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </Layout>
  )
}
