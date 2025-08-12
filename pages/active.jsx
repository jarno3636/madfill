// pages/active.jsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ethers } from 'ethers'

import abi from '@/abi/FillInStoryV3_ABI.json'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Countdown from '@/components/Countdown' // ✅ default export
import ShareBar from '@/components/ShareBar'
import SEO from '@/components/SEO'
import { fetchFarcasterProfile } from '@/lib/neynar'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // ✅ sensible fallback

// --- helpers ---
const needsSpaceBefore = (str) => {
  if (!str) return false
  const ch = str[0]
  return !(/\s/.test(ch) || /[.,!?;:)"'\]]/.test(ch))
}

const buildPreviewSingle = (parts, word, idx) => {
  const n = parts?.length || 0
  if (n === 0) return ''
  const blanks = Math.max(0, n - 1)
  const iSel = Math.max(0, Math.min(Math.max(0, blanks - 1), Number(idx) || 0))
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
  useMiniAppReady()

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

  const provider = useMemo(() => new ethers.JsonRpcProvider(BASE_RPC), [BASE_RPC])
  const contract = useMemo(() => {
    if (!CONTRACT_ADDRESS) return null
    return new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
  }, [CONTRACT_ADDRESS, provider])

  // Load ETH price (Coinbase → CoinGecko → Alchemy → hard fallback)
  const loadPrice = async (signal) => {
    let price = 0
    try {
      const cbRes = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', { signal })
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
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=l2-standard-bridged-weth-base&vs_currencies=usd',
        { signal }
      )
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
            params: ['0x4200000000000000000000000000000000000006'],
          }),
          signal,
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

  const loadRounds = async (priceOverride, signal) => {
    if (!contract) return
    const priceToUse = priceOverride || baseUsd
    const now = Math.floor(Date.now() / 1000)
    const all = []

    const countRaw = await contract.pool1Count()
    const count = Number(countRaw || 0n)
    for (let i = 1; i <= count; i++) {
      if (signal?.aborted) break
      try {
        const info = await contract.getPool1Info(BigInt(i))
        const name = info.name_ ?? info[0]
        const theme = info.theme_ ?? info[1]
        const parts = info.parts_ ?? info[2]
        const feeBaseWei = info.feeBase_ ?? info[3] ?? 0n
        const feeBase = Number(ethers.formatEther(feeBaseWei)) // ✅ ETH value used consistently
        const deadline = Number(info.deadline_ ?? info[4])
        const participants = info.participants_ ?? info[6] ?? []
        const claimed = Boolean(info.claimed_ ?? info[8])

        if (!claimed && deadline > now) {
          // avatars
          const avatars = await Promise.all(
            participants.map(async (addr) => {
              try {
                const res = await fetchFarcasterProfile(addr)
                return {
                  address: addr,
                  avatar: res?.pfp_url || '/Capitalize.PNG',
                  fallbackUsername: res?.username || addr.slice(2, 6).toUpperCase(),
                }
              } catch {
                return {
                  address: addr,
                  avatar: '/Capitalize.PNG',
                  fallbackUsername: addr.slice(2, 6).toUpperCase(),
                }
              }
            })
          )

          // submissions (V3)
          const submissions = await Promise.all(
            participants.map(async (addr) => {
              try {
                const sub = await contract.getPool1Submission(BigInt(i), addr)
                const username = sub.username_ || sub[0] || ''
                const word = sub.word_ || sub[1] || ''
                const submitter = sub.submitter_ || sub[2] || addr
                const blankIndex = Number(sub.blankIndex_ ?? sub[3] ?? 0)
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
            emoji: ['🐸', '🦊', '🦄', '🐢', '🐙'][i % 5],
          })
        }
      } catch (e) {
        console.warn(`Error loading round ${i}`, e)
      }
    }

    setRounds(all)
  }

  useEffect(() => {
    if (!CONTRACT_ADDRESS) return
    const controller = new AbortController()
    const tick = async () => {
      const price = await loadPrice(controller.signal)
      await loadRounds(price, controller.signal)
    }
    tick()
    const interval = setInterval(tick, 30000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract]) // provider/addr changes rebuild contract which retriggers

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
    return rounds.filter((r) => {
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase())
      const matchesFilter =
        filter === 'all' ||
        filter === 'unclaimed' || // kept for future toggle
        (filter === 'high' && parseFloat(r.usd) >= 5)
      return matchesSearch && matchesFilter
    })
  }, [rounds, search, filter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'deadline') return a.deadline - b.deadline
      if (sortBy === 'participants') return b.count - a.count
      if (sortBy === 'prize') return parseFloat(b.usd) - parseFloat(a.usd)
      return b.id - a.id
    })
  }, [filtered, sortBy])

  const totalPages = Math.ceil(sorted.length / roundsPerPage)
  const paginated = sorted.slice((page - 1) * roundsPerPage, page * roundsPerPage)

  // SEO + Frame
  const pageUrl = absoluteUrl('/active')
  const ogImage = buildOgUrl({ screen: 'active', title: 'Active Rounds' })

  return (
    <Layout>
      {/* Farcaster Mini App / Frame meta */}
      <Head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="View Rounds" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
      </Head>

      {/* Standard SEO (OG/Twitter) */}
      <SEO
        title="🧠 Active Rounds — MadFill"
        description="Browse live MadFill rounds on Base. Enter with one word, vote, and win the pot."
        url={pageUrl}
        image={ogImage}
      />

      <main className="max-w-6xl mx-auto p-6 space-y-6 text-white">
        <h1 className="text-4xl font-extrabold drop-shadow">🧠 Active Rounds</h1>

        {!CONTRACT_ADDRESS && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 p-3">
            NEXT_PUBLIC_FILLIN_ADDRESS is not set. Add it in your environment to load rounds.
          </div>
        )}

        {/* controls */}
        <div className="flex flex-wrap justify-between gap-4">
          <input
            type="text"
            placeholder="🔍 Search by name..."
            className="w-full sm:w-1/3 p-2 bg-slate-900 border border-slate-700 rounded"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="p-2 bg-slate-900 border border-slate-700 rounded"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">📅 Newest</option>
            <option value="deadline">⏳ Ending Soon</option>
            <option value="participants">👥 Most Participants</option>
            <option value="prize">💰 Prize Pool</option>
          </select>
          <select
            className="p-2 bg-slate-900 border border-slate-700 rounded"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">🌐 All</option>
            <option value="unclaimed">🪙 Unclaimed Only</option>
            <option value="high">💰 High Pools ($5+)</option>
          </select>
        </div>

        {paginated.length === 0 ? (
          <div className="mt-8 text-lg text-center space-y-3">
            <p>No active rounds right now. Be the first to start one! 🚀</p>
            <Link href="/">
              <Button className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg">
                ➕ Create New Round
              </Button>
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
            {paginated.map((r) => {
              const rUrl = absoluteUrl(`/round/${r.id}`)
              const shareTxt = `Play MadFill Round #${r.id}!`
              return (
                <Card
                  key={r.id}
                  className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl hover:shadow-xl transition-all duration-300"
                >
                  <CardHeader className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{r.emoji}</div>
                      <div>
                        <h2 className="text-lg font-bold">
                          #{r.id} — {r.name}
                        </h2>
                        {r.badge && (
                          <span className="text-sm text-yellow-400 animate-pulse font-semibold">
                            {r.badge}
                          </span>
                        )}
                        <p className="text-xs text-slate-400 mt-1">Theme: {r.theme}</p>
                      </div>
                    </div>
                    <div className="text-sm font-mono mt-1">
                      <Countdown targetTimestamp={r.deadline} />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2 text-sm font-medium">
                    <p>
                      <strong>Entry Fee:</strong> {r.feeBase} ETH
                    </p>
                    <p>
                      <strong>Participants:</strong> {r.count}
                    </p>
                    <p>
                      <strong>Total Pool:</strong> {r.usdApprox ? '~' : ''}${r.usd}
                    </p>

                    {/* Share active round — use OG image so Warpcast shows an embed */}
                    <div className="pt-1">
                      <ShareBar
                        url={rUrl}
                        text={shareTxt}
                        og={{ screen: 'round', roundId: String(r.id) }}
                        small
                      />
                    </div>

                    <button
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                      }
                      className="text-indigo-400 text-xs underline"
                    >
                      {expanded[r.id] ? 'Hide Entries' : 'Show Entries'}
                    </button>

                    {expanded[r.id] && (
                      <div className="bg-slate-700 p-2 rounded text-xs text-slate-100 max-h-48 overflow-y-auto space-y-2">
                        {r.submissions.map((s, idx) => {
                          const p = r.participants.find(
                            (p) => p.address.toLowerCase() === s.address.toLowerCase()
                          )
                          const likeKey = `${r.id}-${idx}`
                          const displayName =
                            s.username || p?.fallbackUsername || s.address.slice(2, 6).toUpperCase()
                          return (
                            <div key={`${s.address}-${idx}`} className="flex items-start gap-2">
                              <img
                                src={p?.avatar || '/Capitalize.PNG'}
                                alt={displayName}
                                width={24}
                                height={24}
                                className="rounded-full border border-white mt-1"
                                onError={(e) => {
                                  e.currentTarget.src = '/Capitalize.PNG'
                                }}
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
                      <Button className="mt-3 bg-indigo-600 hover:bg-indigo-500 w-full">
                        ✏️ Enter Round
                      </Button>
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
                className={`px-4 py-1 rounded-full ${
                  page === i + 1 ? 'bg-indigo-600' : 'bg-slate-700'
                } text-sm`}
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

// (Optional hints for your app wrapper; safe to keep or remove)
ActivePools.usesOwnSEO = true
ActivePools.disableLayout = false
