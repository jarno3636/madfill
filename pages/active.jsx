// pages/active.jsx
'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { ethers } from 'ethers'
import Head from 'next/head'
import abi from '@/abi/FillInStoryV3_ABI.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Countdown } from '@/components/Countdown'
import Link from 'next/link'
import Image from 'next/image'
import { fetchFarcasterProfile } from '@/lib/neynar'
import { motion } from 'framer-motion'
import ShareBar from '@/components/ShareBar'

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FILLIN_ADDRESS

// --- helpers ---
const buildPreviewSingle = (parts, word, idx) => {
  const n = parts?.length || 0
  if (n === 0) return ''
  const blanks = Math.max(0, n - 1)
  const iSel = Math.max(0, Math.min(Math.max(0, blanks - 1), Number(idx) || 0))
  const needsSpaceBefore = (str) => {
    if (!str) return false
    const ch = str[0]
    return !(/\s/.test(ch) || /[.,!?;:)"'\]]/.test(ch))
  }
  const out = []
  for (let i = 0; i < n; i++) {
    out.push(parts[i] || '')
    if (i < n - 1) {
      if (i === iSel) {
        if (word) {
          out.push(word)
          if (needsSpaceBefore(parts[i + 1] || '')) out.push(' ')
        } else {
          out.push('____')
        }
      } else {
        out.push('____')
      }
    }
  }
  return out.join('')
}

export default function ActivePools() {
  const [rounds, setRounds] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [baseUsd, setBaseUsd] = useState(0)
  const [fallbackPrice, setFallbackPrice] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [likes, setLikes] = useState(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('madfillLikes') || '{}')
    }
    return {}
  })
  const roundsPerPage = 6

  // Load BASE price with Coinbase -> CoinGecko -> Alchemy -> $3800 fallback
  const loadPrice = async () => {
    let price = 0
    try {
      const cbRes = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot')
      const cbJson = await cbRes.json()
      const cbPrice = parseFloat(cbJson?.data?.amount)
      if (cbPrice && cbPrice > 0.5) {
        setBaseUsd(cbPrice)
        setFallbackPrice(false)
        return cbPrice
      }
      throw new Error('Invalid Coinbase price')
    } catch {}

    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=l2-standard-bridged-weth-base&vs_currencies=usd')
      const json = await res.json()
      price = json['l2-standard-bridged-weth-base']?.usd
      if (price && price > 0.5) {
        setBaseUsd(price)
        setFallbackPrice(false)
        return price
      }
      throw new Error('Invalid CoinGecko price')
    } catch {}

    try {
      const alchemyRes = await fetch(
        `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'alchemy_getTokenMetadata',
            params: ['0x4200000000000000000000000000000000000006']
          })
        }
      )
      const data = await alchemyRes.json()
      price = data?.result?.price?.usd
      if (price && price > 0.5) {
        setBaseUsd(price)
        setFallbackPrice(false)
        return price
      }
      throw new Error('Invalid Alchemy price')
    } catch {
      price = 3800
      setBaseUsd(price)
      setFallbackPrice(true)
      return price
    }
  }

  const loadRounds = async (priceOverride) => {
    const priceToUse = priceOverride || baseUsd
    const provider = new ethers.JsonRpcProvider(BASE_RPC)
    const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
    const count = Number(await ct.pool1Count())
    const now = Math.floor(Date.now() / 1000)
    const all = []

    for (let i = 1; i <= count; i++) {
      try {
        const info = await ct.getPool1Info(BigInt(i))
        const name = info[0]
        const theme = info[1]
        const parts = info[2]
        const feeBase = Number(ethers.formatEther(info[3] || 0n))
        const deadline = Number(info[4])
        const participants = info[6]
        const claimed = info[8]

        if (!claimed && deadline > now) {
          // avatars
          const avatars = await Promise.all(
            participants.map(async (addr) => {
              try {
                const res = await fetchFarcasterProfile(addr)
                return {
                  address: addr,
                  avatar: res?.pfp_url || '/Capitalize.PNG',
                  fallbackUsername: res?.username || addr.slice(2, 6).toUpperCase()
                }
              } catch {
                return {
                  address: addr,
                  avatar: '/Capitalize.PNG',
                  fallbackUsername: addr.slice(2, 6).toUpperCase()
                }
              }
            })
          )

          // submissions (username, word, submitter, blankIndex)
          const submissions = await Promise.all(
            participants.map(async (addr) => {
              try {
                const sub = await ct.getPool1Submission(BigInt(i), addr)
                const username = sub[0]
                const word = sub[1]
                const submitter = sub[2]
                const blankIndex = Number(sub[3] ?? 0)
                const preview = buildPreviewSingle(parts, word, blankIndex)
                return { address: submitter, username, word, blankIndex, preview }
              } catch {
                return { address: addr, username: '', word: '', blankIndex: 0, preview: buildPreviewSingle(parts, '', 0) }
              }
            })
          )

          const estimatedUsd = priceToUse * participants.length * feeBase

          all.push({
            id: i,
            name: name || 'Untitled',
            theme,
            parts,
            feeBase: feeBase.toFixed(4),
            deadline,
            count: participants.length,
            usd: estimatedUsd.toFixed(2),
            usdApprox: fallbackPrice,
            participants: avatars,
            submissions,
            badge: deadline - now < 3600 ? '🔥 Ends Soon' : estimatedUsd > 5 ? '💰 Top Pool' : null,
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
    const loadData = async () => {
      const price = await loadPrice()
      await loadRounds(price)
    }
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, sortBy, filter])

  const handleLike = (roundId, submissionIdx) => {
    const key = `${roundId}-${submissionIdx}`
    const updated = { ...likes, [key]: !likes[key] }
    setLikes(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('madfillLikes', JSON.stringify(updated))
    }
  }

  const filtered = useMemo(() => {
    return rounds.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase())
      const matchesFilter =
        filter === 'all' ||
        (filter === 'unclaimed') ||
        (filter === 'high' && parseFloat(r.usd) >= 5)
      return matchesSearch && matchesFilter
    })
  }, [rounds, search, filter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'deadline') return a.deadline - b.deadline
      if (sortBy === 'participants') return b.count - a.count
      if (sortBy === 'prize') return b.usd - a.usd
      return b.id - a.id
    })
  }, [filtered, sortBy])

  const totalPages = Math.ceil(sorted.length / roundsPerPage)
  const paginated = sorted.slice((page - 1) * roundsPerPage, page * roundsPerPage)

  return (
    <Layout>
      <Head>
        <title>MadFill – Active Rounds</title>
      </Head>
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-4xl font-extrabold text-white drop-shadow">🧠 Active Rounds</h1>

        {/* controls */}
        <div className="flex flex-wrap justify-between gap-4 text-white">
          <input
            type="text"
            placeholder="🔍 Search by name..."
            className="w-full sm:w-1/3 p-2 bg-slate-900 border border-slate-700 rounded"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="p-2 bg-slate-900 border border-slate-700 rounded" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="newest">📅 Newest</option>
            <option value="deadline">⏳ Ending Soon</option>
            <option value="participants">👥 Most Participants</option>
            <option value="prize">💰 Prize Pool</option>
          </select>
          <select className="p-2 bg-slate-900 border border-slate-700 rounded" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">🌐 All</option>
            <option value="unclaimed">🪙 Unclaimed Only</option>
            <option value="high">💰 High Pools ($5+)</option>
          </select>
        </div>

        {paginated.length === 0 ? (
          <div className="text-white mt-8 text-lg text-center space-y-3">
            <p>No active rounds right now. Be the first to start one! 🚀</p>
            <Link href="/">
              <Button className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg">➕ Create New Round</Button>
            </Link>
          </div>
        ) : (
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {paginated.map(r => {
              const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://madfill.vercel.app'
              const rUrl = `${originUrl}/round/${r.id}`
              const shareTxt = `Play MadFill Round #${r.id}!`
              return (
                <Card key={r.id} className="relative bg-gradient-to-br from-slate-800 to-slate-900 text-white border border-slate-700 rounded-xl hover:shadow-xl transition-all duration-300">
                  <CardHeader className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{r.emoji}</div>
                      <div>
                        <h2 className="text-lg font-bold">#{r.id} — {r.name}</h2>
                        {r.badge && <span className="text-sm text-yellow-400 animate-pulse font-semibold">{r.badge}</span>}
                        <p className="text-xs text-slate-400 mt-1">Theme: {r.theme}</p>
                      </div>
                    </div>
                    <div className="text-sm font-mono mt-1">
                      <Countdown targetTimestamp={r.deadline} />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2 text-sm font-medium">
                    <p><strong>Entry Fee:</strong> {r.feeBase} BASE</p>
                    <p><strong>Participants:</strong> {r.count}</p>
                    <p>
                      <strong>Total Pool:</strong>{' '}
                      {r.usdApprox ? '~' : ''}${r.usd}
                    </p>

                    {/* Share active round */}
                    <div className="pt-1">
                      <ShareBar url={rUrl} text={shareTxt} embedUrl={rUrl} small />
                    </div>

                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                      className="text-indigo-400 text-xs underline"
                    >
                      {expanded[r.id] ? 'Hide Entries' : 'Show Entries'}
                    </button>

                    {expanded[r.id] && (
                      <div className="bg-slate-700 p-2 rounded text-xs text-slate-100 max-h-48 overflow-y-auto space-y-2">
                        {r.submissions.map((s, idx) => {
                          const p = r.participants.find(p => p.address.toLowerCase() === s.address.toLowerCase())
                          const likeKey = `${r.id}-${idx}`
                          const displayName = s.username || p?.fallbackUsername || s.address.slice(2,6).toUpperCase()
                          return (
                            <div key={idx} className="flex items-start gap-2">
                              <Image
                                src={p?.avatar || '/Capitalize.PNG'}
                                alt={displayName}
                                width={24}
                                height={24}
                                className="rounded-full border border-white mt-1"
                                onError={(e) => { e.currentTarget.src = '/Capitalize.PNG' }}
                                unoptimized
                              />
                              <div className="flex-1">
                                <p className="text-slate-300 font-semibold">@{displayName}</p>
                                <p className="italic leading-relaxed">{s.preview}</p>
                              </div>
                              <button
                                onClick={() => handleLike(r.id, idx)}
                                className="text-pink-400 text-sm ml-1"
                                title="Like"
                              >
                                {likes[likeKey] ? '❤️' : '🤍'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <Link href={`/round/${r.id}`}>
                      <Button className="mt-3 bg-indigo-600 hover:bg-indigo-500 w-full">✏️ Enter Round</Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button
                key={i}
                className={`px-4 py-1 rounded-full ${page === i + 1 ? 'bg-indigo-600' : 'bg-slate-700'} text-sm`}
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
