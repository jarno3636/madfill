// pages/active.jsx
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers, formatBytes32String } from 'ethers'
import abi from '@/abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import { motion, AnimatePresence } from 'framer-motion'
import Layout from '@/components/Layout'

const THEMED_NAMES = [
  '🍕 Pizza Party', '👻 Ghost Stories', '🧠 Brainstorm Battle', '🌊 Deep Sea Drama',
  '👽 Alien Adventure', '🎩 Fancy Fables', '🎮 Gamer Mode', '🐸 Toad Madness',
  '💼 Office Mayhem', '🚀 Space Chase', '🧛‍♂️ Vampire Night', '🐉 Dragon Tales',
  '🍔 Food Fight', '🧙 Wizard Wordplay', '🎭 Masquerade Mischief', '🌈 Rainbow Run'
]

export default function Active() {
  const [rounds, setRounds] = useState([])
  const [topPool, setTopPool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModalId, setShowModalId] = useState(null)
  const [entryWord, setEntryWord] = useState('')
  const [blankIndex, setBlankIndex] = useState(0)
  const [entryStatus, setEntryStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const { width, height } = useWindowSize()
  const ENTRY_FEE = '0.001'

  useEffect(() => {
    async function load() {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)

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
        .map((e, i) => {
          const id = e.args.id.toNumber()
          const fee = parseFloat(ethers.formatEther(e.args.entryFee))
          const dl = e.args.deadline.toNumber()
          const rem = Math.max(dl - now, 0)
          const pCnt = paidCount[id] || 0
          const fCnt = freeCount[id] || 0
          const themeName = THEMED_NAMES[i % THEMED_NAMES.length]
          return {
            id,
            name: themeName,
            blanks: e.args.blanks,
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
    return search === '' || r.name.toLowerCase().includes(search.toLowerCase()) || r.id.toString().includes(search)
  })

  const submitEntry = async () => {
    try {
      if (!window.ethereum) throw new Error('No wallet found')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      setBusy(true)
      setEntryStatus('Submitting...')

      const data = formatBytes32String(entryWord)
      const tx = await contract.submitPaid(BigInt(showModalId), Number(blankIndex), data, {
        value: ethers.parseEther(ENTRY_FEE),
      })
      await tx.wait()

      setEntryStatus('✅ Submitted!')
      setTimeout(() => {
        setShowModalId(null)
        setEntryWord('')
        setBlankIndex(0)
        setEntryStatus('')
      }, 2000)
    } catch (e) {
      setEntryStatus('❌ ' + (e?.message || 'Failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <Head><title>Active Rounds | MadFill</title></Head>
      <h1 className="text-3xl font-bold text-center">Active MadFill Rounds</h1>

      {!loading && topPool && (
        <Card className="border-2 border-yellow-400 bg-slate-800 text-white mt-4">
          <CardHeader>
            <h2>🏆 Biggest Pool Right Now</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>{topPool.name}</strong> — Pool: {topPool.pool.toFixed(3)} BASE
            </p>
            <Button onClick={() => setShowModalId(topPool.id)}>Participate</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center mt-6">
        <input
          type="text"
          placeholder="🔍 Search by name or ID"
          className="w-full md:max-w-sm px-4 py-2 rounded-xl bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <p className="text-center mt-6">Loading rounds…</p>}
      {!loading && filtered.length === 0 && <p className="text-center mt-6">No rounds found.</p>}

      <AnimatePresence>
        {!loading && filtered.map(r => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mt-4"
          >
            <Card className="bg-slate-800 text-white shadow-xl rounded-xl">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-semibold">{r.name}</div>
                  <div className="text-sm text-slate-400">ID: {r.id}</div>
                </div>
                <span className="px-2 py-1 text-xs rounded bg-indigo-500 animate-pulse text-white">LIVE</span>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Pool:</strong> {r.pool.toFixed(3)} BASE</p>
                <p><strong>Paid Entries:</strong> {r.paidCount}</p>
                <p><strong>Time Left:</strong> {Math.floor(r.timeRemaining / 3600)}h {Math.floor((r.timeRemaining % 3600) / 60)}m</p>
                <Button onClick={() => setShowModalId(r.id)}>Participate</Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {showModalId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg p-6 w-full max-w-md space-y-4 border border-indigo-700 shadow-lg">
            <h2 className="text-xl font-bold">Enter Round #{showModalId}</h2>
            <div>
              <label>Your Word</label>
              <input
                type="text"
                className="block w-full mt-1 bg-slate-800 text-white border rounded px-2 py-1"
                value={entryWord}
                onChange={(e) => setEntryWord(e.target.value)}
                maxLength={20}
                disabled={busy}
              />
            </div>
            <div>
              <label>Blank Index</label>
              <input
                type="number"
                className="block w-full mt-1 bg-slate-800 text-white border rounded px-2 py-1"
                value={blankIndex}
                onChange={(e) => setBlankIndex(Number(e.target.value))}
                min={0}
                max={4}
                disabled={busy}
              />
            </div>
            <div className="flex justify-between space-x-4">
              <Button onClick={submitEntry} disabled={busy || !entryWord}>Submit Entry</Button>
              <Button variant="ghost" onClick={() => setShowModalId(null)}>Cancel</Button>
            </div>
            {entryStatus && <p className="text-sm">{entryStatus}</p>}
          </div>
          {entryStatus.includes('✅') && <Confetti width={width} height={height} />}
        </div>
      )}
    </Layout>
  )
}
