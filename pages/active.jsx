// pages/active.jsx
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import abi from '@/abi/FillInStoryV3_ABI.json'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Countdown from '@/components/Countdown'
import ShareBar from '@/components/ShareBar'
import SEO from '@/components/SEO'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'

/* ------------------ Config ------------------ */
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

/* Optional deploy-block (hex or decimal) */
const parseBlock = (v) => {
  const s = (v ?? '').toString().trim()
  if (!s) return null
  if (s.startsWith('0x')) {
    const n = Number.parseInt(s, 16)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}
const FILLIN_DEPLOY_BLOCK = parseBlock(process.env.NEXT_PUBLIC_FILLIN_DEPLOY_BLOCK)

/* ------------------ Topics ------------------- */
const TOPIC_POOL1_CREATED = ethers.id('Pool1Created(uint256,address,uint256,uint256)')
const TOPIC_POOL1_CLAIMED = ethers.id('Pool1Claimed(uint256,address,uint256)')

/* ------------------ Utils ------------------- */
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

/* --------- Tiny error boundary for Share ------- */
function ShareBoundary({ children }) {
  const [error, setError] = useState(null)
  if (error) {
    return (
      <div className="text-xs text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded px-2 py-1">
        Share unavailable right now.
      </div>
    )
  }
  return <ErrorCatcher onError={setError}>{children}</ErrorCatcher>
}
class ErrorCatcher extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error) { this.props.onError?.(error) }
  render() { return this.state.hasError ? null : this.props.children }
}

/* ------------------ Page -------------------- */
export default function ActivePools() {
  useMiniAppReady()

  // Warm-up (Warpcast mini app)
  const warmed = useRef(false)
  useEffect(() => {
    if (warmed.current) return
    const inWarpcast = typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)
    if (!inWarpcast) return
    ;(async () => {
      try {
        const mod = await import('@farcaster/miniapp-sdk')
        await mod.sdk.wallet.getEthereumProvider().catch(() => {})
      } catch {}
      warmed.current = true
    })()
  }, [])

  const [rounds, setRounds] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [baseUsd, setBaseUsd] = useState(0)
  const [usdIsApprox, setUsdIsApprox] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [likes, setLikes] = useState(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('madfillLikes') || '{}')
    }
    return {}
  })
  const roundsPerPage = 6

  const provider = useMemo(() => new ethers.JsonRpcProvider(BASE_RPC), [])
  const contract = useMemo(() => {
    if (!CONTRACT_ADDRESS) return null
    return new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
  }, [provider])

  /* ---------------- Price with fallbacks --------------- */
  const loadPrice = async (signal) => {
    try {
      const cbRes = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', { signal })
      const cbJson = await cbRes.json()
      const p = parseFloat(cbJson?.data?.amount)
      if (Number.isFinite(p) && p > 0.5) { setBaseUsd(p); setUsdIsApprox(false); return p }
      throw new Error('bad cb')
    } catch {}

    try {
      const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', { signal })
      const cgJson = await cgRes.json()
      const p = Number(cgJson?.ethereum?.usd)
      if (Number.isFinite(p) && p > 0.5) { setBaseUsd(p); setUsdIsApprox(false); return p }
      throw new Error('bad cg')
    } catch {}

    const fallback = 3800
    setBaseUsd(fallback); setUsdIsApprox(true)
    return fallback
  }

  /* ---------------- Helpers --------------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const withRetry = async (fn, { tries = 3, delay = 200 } = {}) => {
    let last
    for (let i = 0; i < tries; i++) {
      try { return await fn() } catch (e) { last = e; if (i < tries - 1) await sleep(delay * (i + 1)) }
    }
    throw last
  }

  // simple concurrency limiter
  const limitMap = async (items, limit, worker, signal) => {
    const results = new Array(items.length)
    let idx = 0
    const run = async () => {
      while (idx < items.length) {
        if (signal?.aborted) return
        const cur = idx++
        results[cur] = await worker(items[cur], cur)
      }
    }
    const runners = Array.from({ length: Math.min(limit, items.length) }, () => run())
    await Promise.all(runners)
    return results
  }

  // chunked getLogs to avoid RPC window limits
  const getLogsChunked = async ({ address, topics, fromBlock, toBlock, chunkSize = 200_000 }, signal) => {
    const logs = []
    let start = fromBlock
    while (start <= toBlock) {
      if (signal?.aborted) break
      const end = Math.min(toBlock, start + chunkSize)
      // eslint-disable-next-line no-await-in-loop
      const part = await withRetry(() =>
        provider.getLogs({ address, topics, fromBlock: start, toBlock: end })
      ).catch(() => [])
      logs.push(...part)
      start = end + 1
    }
    return logs
  }

  /* -------------- Load rounds via logs + robust fallback -------------- */
  const loadRounds = async (price, signal) => {
    if (!contract) return setRounds([])

    const nowSec = Math.floor(Date.now() / 1000)

    // widen window (and chunk it) so we don't miss older still-active rounds
    const latest = await withRetry(() => provider.getBlockNumber())
    const DEFAULT_WINDOW = 2_000_000 // ~weeks on Base; widen if needed
    const fromBlock = FILLIN_DEPLOY_BLOCK ?? Math.max(0, latest - DEFAULT_WINDOW)

    // 1) Logs (created & claimed) in chunks
    const [createdLogs, claimedLogs] = await Promise.all([
      getLogsChunked({
        address: CONTRACT_ADDRESS,
        topics: [TOPIC_POOL1_CREATED],
        fromBlock,
        toBlock: latest,
      }, signal),
      getLogsChunked({
        address: CONTRACT_ADDRESS,
        topics: [TOPIC_POOL1_CLAIMED],
        fromBlock,
        toBlock: latest,
      }, signal),
    ])
    if (signal?.aborted) return

    // 2) Parse IDs
    const createdIds = Array.from(
      new Set(
        createdLogs
          .map((lg) => {
            try { return BigInt(lg.topics?.[1]).toString() } catch { return null }
          })
          .filter(Boolean)
      )
    )

    const claimedSet = new Set(
      claimedLogs
        .map((lg) => {
          try { return BigInt(lg.topics?.[1]).toString() } catch { return null }
        })
        .filter(Boolean)
    )

    // helper to build a UI round from on-chain info
    const roundFromInfo = async (idBI, info) => {
      const name = info.name_ ?? info[0]
      const theme = info.theme_ ?? info[1]
      const parts = info.parts_ ?? info[2]
      const feeBaseWei = info.feeBase_ ?? info[3] ?? 0n
      const deadline = Number(info.deadline_ ?? info[4])
      const participants = info.participants_ ?? info[6] ?? []
      const claimed = Boolean(info.claimed_ ?? info[8])

      if (claimed || deadline <= nowSec) return null

      let submissions = []
      try {
        const packed = await withRetry(() => contract.getPool1SubmissionsPacked(idBI))
        const addrs = packed.addrs || packed[0] || []
        const usernames = packed.usernames || packed[1] || []
        const words = packed.words || packed[2] || []
        const blankIdxs = packed.blankIndexes || packed[3] || []
        submissions = addrs.map((addr, i) => {
          const username = usernames[i] || ''
          const word = words[i] || ''
          const idx = Number(blankIdxs[i] ?? 0)
          return { address: addr, username, word, blankIndex: idx, preview: buildPreviewSingle(parts, word, idx) }
        })
      } catch { /* non-fatal */ }

      const feeBase = Number(ethers.formatEther(feeBaseWei))
      const estimatedUsd = price * (participants?.length || 0) * feeBase

      return {
        id: Number(idBI),
        name: name || `Round #${idBI}`,
        theme,
        parts,
        feeBase: feeBase.toFixed(4),
        deadline,
        count: participants?.length || 0,
        usd: estimatedUsd.toFixed(2),
        usdApprox: usdIsApprox,
        submissions,
        badge: deadline - nowSec < 3600 ? '🔥 Ends Soon' : estimatedUsd > 5 ? '💰 Top Pool' : null,
        emoji: ['🐸', '🦊', '🦄', '🐢', '🐙'][Number(idBI) % 5],
      }
    }

    // 3) Build from logs
    let roundsFromLogs = []
    if (createdIds.length > 0) {
      const details = await limitMap(
        createdIds,
        6, // concurrency
        async (idStr) => {
          if (signal?.aborted) return null
          if (claimedSet.has(idStr)) return null
          try {
            const idBI = BigInt(idStr)
            const info = await withRetry(() => contract.getPool1Info(idBI))
            return await roundFromInfo(idBI, info)
          } catch { return null }
        },
        signal
      )
      roundsFromLogs = details.filter(Boolean)
    }

    // 4) Fallback if logs empty (scan the last N ids)
    if (roundsFromLogs.length === 0) {
      try {
        const count = Number(await withRetry(() => contract.pool1Count()))
        if (count > 0) {
          const N = 120 // scan last N ids; adjust to your appetite
          const start = Math.max(1, count - N + 1)
          const ids = Array.from({ length: count - start + 1 }, (_, i) => BigInt(start + i))

          const details = await limitMap(
            ids.reverse(), // newest first
            6,
            async (idBI) => {
              if (signal?.aborted) return null
              try {
                const info = await withRetry(() => contract.getPool1Info(idBI))
                return await roundFromInfo(idBI, info)
              } catch { return null }
            },
            signal
          )
          roundsFromLogs = details.filter(Boolean)
        }
      } catch {
        // leave empty if fallback also fails
      }
    }

    // 5) Commit
    setRounds(roundsFromLogs.sort((a, b) => (b?.id || 0) - (a?.id || 0)))
  }

  /* -------------- Main polling loop -------------- */
  useEffect(() => {
    if (!CONTRACT_ADDRESS) return
    const controller = new AbortController()

    const tick = async () => {
      if (controller.signal.aborted) return
      const price = await loadPrice(controller.signal)
      if (controller.signal.aborted) return
      await loadRounds(price, controller.signal)
    }

    tick()
    const interval = setInterval(tick, 30_000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract])

  useEffect(() => { setPage(1) }, [search, sortBy, filter])

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
        filter === 'unclaimed' || // kept for compatibility; all are unclaimed by construction
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

  const totalPages = Math.ceil(sorted.length / roundsPerPage) || 1
  const pageSafe = Math.min(page, totalPages)
  const paginated = sorted.slice((pageSafe - 1) * roundsPerPage, pageSafe * roundsPerPage)

  // SEO / Frame
  const pageUrl = absoluteUrl('/active')
  const ogImage = buildOgUrl({ screen: 'active', title: 'Active Rounds' })

  return (
    <Layout>
      <Head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="View Rounds" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
      </Head>

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
            key={pageSafe}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {paginated.map((r) => {
              const rUrl = absoluteUrl(`/round/${r.id}`)
              const minsLeft = Math.max(1, Math.round((r.deadline - Math.floor(Date.now() / 1000)) / 60))

              return (
                <Card
                  key={r.id}
                  className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl hover:shadow-xl transition-all duration-300"
                >
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
                    <p><strong>Entry Fee:</strong> {r.feeBase} ETH</p>
                    <p><strong>Participants:</strong> {r.count}</p>
                    <p><strong>Total Pool:</strong> {r.usdApprox ? '~' : ''}${r.usd}</p>

                    <div className="pt-1">
                      <ShareBoundary>
                        <ShareBar
                          url={rUrl}
                          title={`🧠 Join MadFill Round #${r.id}!`}
                          theme={r.theme || 'MadFill'}
                          templateName={r.name || `Round #${r.id}`}
                          feeEth={r.feeBase}
                          durationMins={minsLeft}
                          hashtags={['MadFill', 'Base', 'Farcaster']}
                          embed="/og/cover.PNG"
                        />
                      </ShareBoundary>
                    </div>

                    {r.submissions?.length > 0 && (
                      <>
                        <button
                          onClick={() => setExpanded((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                          className="text-indigo-400 text-xs underline"
                        >
                          {expanded[r.id] ? 'Hide Entries' : 'Show Entries'}
                        </button>

                        {expanded[r.id] && (
                          <div className="bg-slate-700 p-2 rounded text-xs text-slate-100 max-h-48 overflow-y-auto space-y-2">
                            {r.submissions.map((s, idx) => {
                              const likeKey = `${r.id}-${idx}`
                              const displayName =
                                s.username || (typeof s.address === 'string' ? s.address.slice(2, 6).toUpperCase() : 'USER')
                              return (
                                <div key={`${s.address}-${idx}`} className="flex items-start gap-2">
                                  <img
                                    src={`https://effigy.im/a/${s.address}`}
                                    alt={displayName}
                                    width={24}
                                    height={24}
                                    className="rounded-full border border-white mt-1"
                                    onError={(e) => { e.currentTarget.src = '/Capitalize.PNG' }}
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
                      </>
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
                className={`px-4 py-1 rounded-full ${pageSafe === i + 1 ? 'bg-indigo-600' : 'bg-slate-700'} text-sm`}
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

ActivePools.usesOwnSEO = true
ActivePools.disableLayout = false
