// pages/active.jsx
'use client'

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
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

/* ------------------ Tiny utils ------------------ */
const needsSpaceBefore = (str) => !!str && !(/\s/.test(str[0]) || /[.,!?;:)"'\]]/.test(str[0]))

const buildPreviewSingle = (parts, word, idx) => {
  const n = parts?.length || 0
  if (!n) return ''
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const withRetry = async (fn, { tries = 3, delay = 200 } = {}) => {
  let last
  for (let i = 0; i < tries; i++) {
    try { return await fn() } catch (e) { last = e; if (i < tries - 1) await sleep(delay * (i + 1)) }
  }
  throw last
}
const chunk = (arr, size) => arr.length ? [arr.slice(0, size), ...chunk(arr.slice(size), size)] : []

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

  /* ------------------ State ------------------ */
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const roundsPerPage = 6

  const [baseUsd, setBaseUsd] = useState(0)
  const [usdIsApprox, setUsdIsApprox] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [likes, setLikes] = useState(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('madfillLikes') || '{}')
    }
    return {}
  })

  /* ------------------ Provider/Contract ------------------ */
  const provider = useMemo(
    () => new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true }),
    []
  )
  const contract = useMemo(() => {
    if (!CONTRACT_ADDRESS) return null
    return new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
  }, [provider])

  /* ---------------- Price with fallbacks --------------- */
  const loadPrice = useCallback(async (signal) => {
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
  }, [])

  /* ---------------- Core loader (no logs; chunked reads) --------------- */
  const loadActiveRounds = useCallback(async (signal) => {
    if (!contract) { setRounds([]); return }

    setLoading(true)
    setStatus('')

    const nowSec = Math.floor(Date.now() / 1000)

    try {
      const price = await loadPrice(signal).catch(() => baseUsd || 3800)

      const total = Number(await withRetry(() => contract.pool1Count()))
      if (!total) { setRounds([]); setStatus(''); return }

      // Pull newest first, bounded to last N
      const N = 120
      const start = Math.max(1, total - N + 1)
      const ids = Array.from({ length: total - start + 1 }, (_, i) => BigInt(start + i)).reverse()

      // Chunk calls to avoid RPC rate-limits
      const chunks = chunk(ids, 24)
      const out = []

      for (const group of chunks) {
        if (signal?.aborted) return

        const infos = await Promise.allSettled(
          group.map((idBI) => withRetry(() => contract.getPool1Info(idBI)))
        )

        for (let i = 0; i < infos.length; i++) {
          if (infos[i].status !== 'fulfilled') continue
          const info = infos[i].value
          const idBI = group[i]

          try {
            const name = info.name_ ?? info[0]
            const theme = info.theme_ ?? info[1]
            const parts = info.parts_ ?? info[2]
            const feeBaseWei = info.feeBase_ ?? info[3] ?? 0n
            const deadline = Number(info.deadline_ ?? info[4])
            const participants = info.participants_ ?? info[6] ?? []
            const claimed = Boolean(info.claimed_ ?? info[8])

            // Only show active rounds
            if (claimed || deadline <= nowSec) continue

            // (Optional) preview from first few submissions if packed call exists
            let submissions = []
            try {
              const packed = await withRetry(() => contract.getPool1SubmissionsPacked(idBI))
              const addrs = packed.addrs || packed[0] || []
              const usernames = packed.usernames || packed[1] || []
              const words = packed.words || packed[2] || []
              const blankIdxs = packed.blankIndexes || packed[3] || []
              const m = Math.min(addrs.length, 6)
              submissions = Array.from({ length: m }, (_, j) => {
                const addr = addrs[j]
                const username = usernames[j] || ''
                const word = words[j] || ''
                const idx = Number(blankIdxs[j] ?? 0)
                return { address: addr, username, word, blankIndex: idx, preview: buildPreviewSingle(parts, word, idx) }
              })
            } catch { /* safe ignore if not available */ }

            const feeBase = Number(ethers.formatEther(feeBaseWei))
            const estimatedUsd = price * (participants?.length || 0) * feeBase

            out.push({
              id: Number(idBI),
              name: name || `Round #${idBI}`,
              theme,
              parts,
              feeBase: feeBase.toFixed(4),
              deadline,
              count: participants?.length || 0,
              usd: (estimatedUsd || 0).toFixed(2),
              usdApprox: usdIsApprox,
              submissions,
              badge: deadline - nowSec < 3600 ? '🔥 Ends Soon' : (estimatedUsd > 5 ? '💰 Top Pool' : null),
              emoji: ['🐸', '🦊', '🦄', '🐢', '🐙'][Number(idBI) % 5],
            })
          } catch { /* skip malformed */ }
        }
      }

      setRounds(out.sort((a, b) => (b?.id || 0) - (a?.id || 0)))
      setStatus(out.length ? '' : 'No active rounds found.')
    } catch (e) {
      console.error('Active load failed:', e)
      setRounds([])
      setStatus('Failed to load active rounds. Tap Refresh.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [contract, loadPrice, baseUsd, usdIsApprox])

  /* -------------- Initial + polling -------------- */
  useEffect(() => {
    if (!CONTRACT_ADDRESS) return
    const controller = new AbortController()
    const tick = () => loadActiveRounds(controller.signal)
    tick()
    const interval = setInterval(tick, 30_000)
    return () => { controller.abort(); clearInterval(interval) }
  }, [loadActiveRounds])

  useEffect(() => { setPage(1) }, [search, sortBy, filter])

  /* ---------------- UI helpers ---------------- */
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
      const matchesSearch = (r.name || '').toLowerCase().includes(search.toLowerCase())
      const matchesFilter =
        filter === 'all' ||
        (filter === 'high' && parseFloat(r.usd) >= 5)
      return matchesSearch && matchesFilter
    })
  }, [rounds, search, filter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'deadline') return a.deadline - b.deadline
      if (sortBy === 'participants') return (b.count || 0) - (a.count || 0)
      if (sortBy === 'prize') return parseFloat(b.usd) - parseFloat(a.usd)
      return (b.id || 0) - (a.id || 0)
    })
  }, [filtered, sortBy])

  const totalPages = Math.ceil(sorted.length / roundsPerPage) || 1
  const pageSafe = Math.min(page, totalPages)
  const paginated = sorted.slice((pageSafe - 1) * roundsPerPage, pageSafe * roundsPerPage)

  const refreshNow = () => {
    const ac = new AbortController()
    loadActiveRounds(ac.signal)
  }

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
        <link rel="canonical" href={pageUrl} />
      </Head>

      <SEO
        title="🧠 Active Rounds — MadFill"
        description="Browse live MadFill rounds on Base. Enter with one word, vote, and win the pot."
        url={pageUrl}
        image={ogImage}
      />

      {/* --- CONTAINER + CENTERING + OVERFLOW FIXES --- */}
      <main className="w-full mx-auto max-w-6xl px-4 sm:px-6 md:px-8 py-4 md:py-6 text-white overflow-x-hidden">
        {/* Hero (match Vote/Community) */}
        <div className="w-full min-w-0 rounded-2xl bg-slate-900/70 border border-slate-700 p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight bg-gradient-to-r from-amber-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent break-words min-w-0">
              🧠 Active Rounds
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="secondary"
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600"
                onClick={refreshNow}
                title="Refresh rounds"
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-slate-300 max-w-3xl break-words">
            Browse live rounds happening right now. Enter with a word, cast votes, and win the prize pool.
          </p>
          {status && (
            <div className="mt-2 text-amber-200 text-sm" aria-live="polite">
              {status}
            </div>
          )}
        </div>

        {!CONTRACT_ADDRESS && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 p-3 mb-4">
            NEXT_PUBLIC_FILLIN_ADDRESS is not set. Add it in your environment to load rounds.
          </div>
        )}

        {/* Controls */}
        <div className="w-full min-w-0 flex flex-wrap justify-between gap-3 mb-6">
          <input
            type="text"
            placeholder="🔍 Search by name..."
            className="min-w-0 flex-1 sm:flex-none sm:w-1/3 p-2 bg-slate-900 border border-slate-700 rounded"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              className="p-2 bg-slate-900 border border-slate-700 rounded flex-1 sm:flex-none"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">📅 Newest</option>
              <option value="deadline">⏳ Ending Soon</option>
              <option value="participants">👥 Most Participants</option>
              <option value="prize">💰 Prize Pool</option>
            </select>
            <select
              className="p-2 bg-slate-900 border border-slate-700 rounded flex-1 sm:flex-none"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">🌐 All</option>
              <option value="high">💰 High Pools ($5+ est.)</option>
            </select>
          </div>
        </div>

        {/* Body */}
        {loading && rounds.length === 0 ? (
          <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-6 text-center text-slate-300">
            Loading active rounds…
          </div>
        ) : paginated.length === 0 ? (
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
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {paginated.map((r) => {
              const rUrl = absoluteUrl(`/round/${r.id}`)
              const minsLeft = Math.max(1, Math.round((r.deadline - Math.floor(Date.now() / 1000)) / 60))
              return (
                <Card
                  key={r.id}
                  className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700 min-w-0 overflow-hidden"
                >
                  <CardHeader className="flex justify-between items-start gap-3 min-w-0">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="text-3xl shrink-0">{r.emoji}</div>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold truncate">#{r.id} — {r.name}</h2>
                        {r.badge && <span className="text-sm text-yellow-400">{r.badge}</span>}
                        {r.theme && <p className="text-xs text-slate-400 mt-1 break-words">Theme: {r.theme}</p>}
                      </div>
                    </div>
                    <div className="text-sm font-mono mt-1 shrink-0">
                      <Countdown targetTimestamp={r.deadline} />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2 text-sm font-medium min-w-0">
                    <p className="break-words"><strong>Entry Fee:</strong> {r.feeBase} ETH</p>
                    <p><strong>Participants:</strong> {r.count}</p>
                    <p><strong>Total Pool:</strong> {r.usdApprox ? '~' : ''}${r.usd}</p>

                    <div className="pt-1 min-w-0">
                      <ShareBoundary>
                        <div className="min-w-0">
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
                        </div>
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
                                    className="w-6 h-6 rounded-full border border-white mt-1 shrink-0"
                                    onError={(e) => { e.currentTarget.src = '/Capitalize.PNG' }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-slate-300 font-semibold truncate">@{displayName}</p>
                                    <p className="italic leading-relaxed break-words">{s.preview}</p>
                                  </div>
                                  <button
                                    onClick={() => handleLike(r.id, idx)}
                                    className="text-pink-400 text-sm ml-1 shrink-0"
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

                    <Link href={`/round/${r.id}`} className="block">
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

        {/* Footer (matches Vote/Community) */}
        <footer className="mt-10 text-xs text-slate-400 flex flex-wrap items-center gap-3 justify-between border-t border-slate-800 pt-4">
          <div className="flex items-center gap-3">
            <Link href="/challenge" className="underline text-indigo-300">Start a Challenge</Link>
            <a
              href={`https://basescan.org/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="underline text-indigo-300"
              title="View contract on BaseScan"
            >
              Contract
            </a>
          </div>
          <div className="opacity-80">Built on Base • MadFill</div>
        </footer>
      </main>
    </Layout>
  )
}

ActivePools.usesOwnSEO = true
ActivePools.disableLayout = false
