// pages/active.jsx
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import { motion, AnimatePresence } from 'framer-motion'

export default function Active() {
  const [rounds, setRounds] = useState([])
  const [topPool, setTopPool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const { width, height } = useWindowSize()

  useEffect(() => {
    async function load() {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        provider
      )

      const [started, paidE, freeE] = await Promise.all([
        contract.queryFilter(contract.filters.Started(), 0, 'latest'),
        contract.queryFilter(contract.filters.Paid(), 0, 'latest'),
        contract.queryFilter(contract.filters.Free(), 0, 'latest'),
      ])

      const paidCount = {}
      paidE.forEach(e => {
        const id = e.args.id.toNumber()
        paidCount[id] = (paidCount[id] || 0) + 1
      })
      const freeCount = {}
      freeE.forEach(e => {
        const id = e.args.id.toNumber()
        freeCount[id] = (freeCount[id] || 0) + 1
      })

      const now = Math.floor(Date.now() / 1000)
      const items = started
        .map(e => {
          const id = e.args.id.toNumber()
          const fee = parseFloat(ethers.formatEther(e.args.entryFee))
          const dl = e.args.deadline.toNumber()
          const rem = Math.max(dl - now, 0)
          const pCnt = paidCount[id] || 0
          const fCnt = freeCount[id] || 0
          return {
            id,
            fee,
            deadline: dl,
            timeRemaining: rem,
            paidCount: pCnt,
            freeCount: fCnt,
            pool: pCnt * fee,
          }
        })
        .filter(r => r.timeRemaining > 0)
        .slice(-10)

      setRounds(items)
      if (items.length) {
        const top = items.reduce((a, b) => (b.pool > a.pool ? b : a), items[0])
        setTopPool(top)
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = rounds.filter(r => {
    const matchTab =
      tab === 'all' ||
      (tab === 'paid' && r.paidCount > 0) ||
      (tab === 'free' && r.freeCount > 0)
    const matchSearch = search === '' || r.id.toString().includes(search)
    return matchTab && matchSearch
  })

  return (
    <>
      <Head><title>Active Rounds | MadFill</title></Head>
      <div className="bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 min-h-screen text-white">
        <nav className="flex justify-between items-center p-6 shadow-xl bg-slate-950 border-b border-indigo-700">
          <h1 className="text-2xl font-extrabold tracking-tight cursor-pointer hover:text-indigo-300 transition drop-shadow-md" onClick={() => window.location.href = '/'}>
            <span className="animate-pulse">🧠 MadFill</span>
          </h1>
        </nav>
        <main className="max-w-3xl mx-auto p-6 space-y-6">
          <h1 className="text-3xl font-bold text-center">Active MadFill Rounds</h1>

          {/* Top Pool */}
          {!loading && topPool && (
            <Card className="border-2 border-yellow-400 bg-slate-800 text-white">
              <CardHeader>
                <h2>🏆 Biggest Pool Right Now</h2>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>
                  <strong>Round #{topPool.id}</strong> — Pool: {topPool.pool.toFixed(3)} BASE
                </p>
                <Button onClick={() => window.location.href = `/?roundId=${topPool.id}`}>Participate</Button>
              </CardContent>
            </Card>
          )}

          {/* Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-6">
            <input
              type="text"
              placeholder="🔍 Search Round ID"
              className="w-full md:max-w-sm px-4 py-2 rounded-xl bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="flex space-x-2">
              {['all', 'paid', 'free'].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-full border transition duration-200 ${
                    tab === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-800 text-gray-300 border-slate-600'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {loading && <p className="text-center">Loading rounds…</p>}

          {/* Round List */}
          {!loading && filtered.length === 0 && (
            <p className="text-center">No {tab} rounds found.</p>
          )}

          <AnimatePresence>
            {!loading && filtered.map(r => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
                  <CardHeader className="flex justify-between items-center">
                    <span>Round #{r.id}</span>
                    <span className="px-2 py-1 text-xs rounded bg-indigo-500 animate-pulse text-white">LIVE</span>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Pool:</strong> {r.pool.toFixed(3)} BASE</p>
                    <p><strong>Paid Entries:</strong> {r.paidCount}</p>
                    <p><strong>Free Entries:</strong> {r.freeCount}</p>
                    <p>
                      <strong>Time Left:</strong>{' '}
                      {Math.floor(r.timeRemaining / 3600)}h{' '}
                      {Math.floor((r.timeRemaining % 3600) / 60)}m
                    </p>
                    <Button onClick={() => window.location.href = `/?roundId=${r.id}`}>Participate</Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </main>
      </div>
    </>
  )
}
