// pages/vote.jsx
'use client'

import { useEffect, useMemo, useRef, useState, useCallback, Fragment } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'
import dynamic from 'next/dynamic'

import Layout from '@/components/Layout'
import SEO from '@/components/SEO'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryV3_ABI.json'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import { useTx } from '@/components/TxProvider'
import { shareOrCast } from '@/lib/share'

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

/* ---------------- config ---------------- */
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

/* ---------------- utils ---------------- */
const nowSec = () => Math.floor(Date.now() / 1000)
const explorer = (path) => `https://basescan.org/${path}`
const toEth = (wei) => (wei ? Number(ethers.formatEther(wei)) : 0)
const fmt = (n, d = 2) => new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n)

const shareToX = (text, url) => {
  try {
    const u = new URL('https://twitter.com/intent/tweet')
    u.searchParams.set('text', text)
    if (url) u.searchParams.set('url', url)
    window.open(u.toString(), '_blank', 'noopener,noreferrer')
  } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function withRetry(fn, { tries = 4, minDelay = 150, maxDelay = 800, signal } = {}) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    if (signal?.aborted) throw new Error('aborted')
    try { return await fn() } catch (e) {
      lastErr = e
      const msg = String(e?.message || e)
      // don’t hammer on clear reverts
      if (/aborted|revert|CALL_EXCEPTION/i.test(msg)) break
      const backoff = Math.min(maxDelay, minDelay * Math.pow(2, i))
      const jitter = Math.floor(Math.random() * 80)
      await sleep(backoff + jitter)
    }
  }
  throw lastErr
}
function mapLimit(items, limit, worker) {
  let i = 0, active = 0
  const out = new Array(items.length)
  return new Promise((resolve) => {
    const next = () => {
      if (i >= items.length && active === 0) return resolve(out)
      while (active < limit && i < items.length) {
        const idx = i++, it = items[idx]; active++
        Promise.resolve(worker(it, idx))
          .then((res) => { out[idx] = res })
          .catch((err) => { out[idx] = { __error: err } })
          .finally(() => { active--; next() })
      }
    }
    next()
  })
}
const CONCURRENCY = 8

/* ---------------- minor UI ---------------- */
function formatRemaining(s) {
  if (s <= 0) return '0:00'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${sec.toString().padStart(2, '0')}`
}
function TimeLeft({ deadline }) {
  const [left, setLeft] = useState(Math.max(0, (deadline || 0) - nowSec()))
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, (deadline || 0) - nowSec())), 1000)
    return () => clearInterval(id)
  }, [deadline])
  if (!deadline) return null
  if (left <= 0)
    return (
      <span className="px-2 py-0.5 rounded-full bg-slate-700/60 border border-slate-600 text-slate-200 text-[11px] font-medium whitespace-nowrap">
        🏁 Ended
      </span>
    )
  return (
    <span
      className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[11px] font-medium whitespace-nowrap"
      title={`${left} seconds left`}
    >
      ⏳ {formatRemaining(left)} left
    </span>
  )
}

function HighlightBlanks({ text }) {
  if (!text) return null
  const parts = String(text).split('____')
  return (
    <span>
      {parts.map((chunk, i) => (
        <Fragment key={i}>
          <span className="text-slate-100">{chunk}</span>
          {i < parts.length - 1 && (
            <span className="px-1 rounded-md bg-slate-700/70 text-amber-300 font-semibold align-baseline">____</span>
          )}
        </Fragment>
      ))}
    </span>
  )
}

function StatusPill({ deadline }) {
  const ended = deadline > 0 && nowSec() >= deadline
  if (!ended)
    return (
      <span className="px-2 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs">
        Voting
      </span>
    )
  return (
    <span className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs">
      Finished
    </span>
  )
}

function WinnerBadge() {
  return (
    <span className="absolute -top-2 -right-2 px-2 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-semibold shadow">
      Winner
    </span>
  )
}

/* ---------------- page ---------------- */
export default function VotePage() {
  useMiniAppReady()
  const { address, isOnBase, isWarpcast, connect, switchToBase, votePool2, claimPool2 } = useTx()

  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [success, setSuccess] = useState(false)
  const [claimedId, setClaimedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [priceUsd, setPriceUsd] = useState(3800)

  const { width, height } = useWindowSize()
  const tickRef = useRef(null)

  // benign RPC/tx errors we treat as success if chain state confirms
  const benignPatterns = [
    /could not coalesce/i, /already known/i, /replacement transaction underpriced/i,
    /nonce .* too low/i, /fee too low/i, /transaction (?:not )?mined/i,
  ]
  const isBenignTxError = (e) => {
    const msg = String(e?.shortMessage || e?.message || e || '')
    return benignPatterns.some((re) => re.test(msg))
  }

  // preview helpers
  function parseStoredWord(stored) {
    if (!stored) return { index: 0, word: '' }
    const sep = stored.indexOf('::')
    if (sep > -1) {
      const idxRaw = stored.slice(0, sep)
      const w = stored.slice(sep + 2)
      const idx = Math.max(0, Math.min(99, Number.parseInt(idxRaw, 10) || 0))
      return { index: idx, word: w }
    }
    return { index: 0, word: stored }
  }
  const needsSpaceBefore = (str) => !( /\s/.test(str?.[0]) || /[.,!?;:)"'\]]/.test(str?.[0]) )
  function buildPreviewSingle(parts, word, blankIndex) {
    const n = parts?.length || 0
    if (n === 0) return ''
    const blanks = Math.max(0, n - 1)
    const idx = Math.max(0, Math.min(Math.max(0, blanks - 1), Number(blankIndex) || 0))
    const out = []
    for (let i = 0; i < n; i++) {
      out.push(parts[i] || '')
      if (i < n - 1) {
        if (i === idx) {
          if (word) {
            out.push(word)
            if (needsSpaceBefore(parts[i + 1] || '')) out.push(' ')
          } else out.push('____')
        } else out.push('____')
      }
    }
    return out.join('')
  }
  const buildPreviewFromStored = (parts, stored) => {
    const { index, word } = parseStoredWord(stored)
    return buildPreviewSingle(parts, word, index)
  }

  // cache keys (vote page doesn’t depend on wallet; cache by contract)
  const cacheKey = `vote:p2:${CONTRACT_ADDRESS.toLowerCase()}`
  const hydrateFromCache = useCallback(() => {
    try {
      const j = JSON.parse(localStorage.getItem(cacheKey) || '{}')
      if (Array.isArray(j?.data)) setRounds(j.data)
      if (j?.status) setStatus(j.status)
    } catch {}
  }, [cacheKey])
  const persistCache = useCallback((data, statusMsg = '') => {
    try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data, status: statusMsg })) } catch {}
  }, [cacheKey])

  useEffect(() => { hydrateFromCache() }, [hydrateFromCache])

  // price + heartbeat
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const j = await r.json()
        setPriceUsd(j?.ethereum?.usd || 3800)
      } catch { setPriceUsd(3800) }
    })()
    tickRef.current = setInterval(() => setStatus((s) => (s ? s : '')), 1000)
    return () => clearInterval(tickRef.current)
  }, [])

  /* ---------------- load all P2 (robust) ---------------- */
  const abortRef = useRef(null)
  const loadAll = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setStatus('')

    const provider = new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true })
    const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)

    try {
      const total = Number(await withRetry(() => ct.pool2Count(), { signal: controller.signal }))
      if (controller.signal.aborted) return
      if (!total) { setRounds([]); persistCache([]); setLoading(false); return }

      // newest first
      const ids = Array.from({ length: total }, (_, i) => total - i)

      // fetch each P2, then enrich with P1 pieces using limited concurrency
      const rows = await mapLimit(ids, CONCURRENCY, async (id) => {
        if (controller.signal.aborted) return null
        try {
          const info = await withRetry(() => ct.getPool2InfoFull(BigInt(id)), { signal: controller.signal })
          const originalPool1Id = Number(info.originalPool1Id ?? info[0])
          const challengerWordRaw = info.challengerWord ?? info[1]
          const challengerUsername = info.challengerUsername ?? info[2]
          const votersOriginal = Number(info.votersOriginalCount ?? info[4] ?? 0)
          const votersChallenger = Number(info.votersChallengerCount ?? info[5] ?? 0)
          const claimed = Boolean(info.claimed ?? info[6])
          const challengerWon = Boolean(info.challengerWon ?? info[7])
          const poolBalance = info.poolBalance ?? info[8]
          const feeBase = info.feeBase ?? info[9] ?? info[10]
          const deadline = Number(info.deadline ?? info[10] ?? info[11] ?? 0)

          const p1 = await withRetry(() => ct.getPool1Info(BigInt(originalPool1Id)), { signal: controller.signal })
          const parts = p1.parts_ || p1[2]
          const creatorAddr = p1.creator_ || p1[5]
          const p1CreatorSub = await withRetry(
            () => ct.getPool1Submission(BigInt(originalPool1Id), creatorAddr),
            { tries: 3, minDelay: 120, maxDelay: 300, signal: controller.signal }
          ).catch(() => null)
          const originalWordRaw = p1CreatorSub?.word || p1CreatorSub?.[1] || ''

          const originalPreview = buildPreviewFromStored(parts, originalWordRaw)
          const challengerPreview = buildPreviewFromStored(parts, challengerWordRaw)

          const poolEth = toEth(poolBalance)
          const poolUsd = poolEth * priceUsd
          const feeEth = toEth(feeBase)
          const totalVotes = Math.max(0, votersOriginal + votersChallenger)

          return {
            id,
            originalPool1Id,
            parts,
            originalPreview,
            originalWordRaw,
            challengerPreview,
            challengerWordRaw,
            challengerUsername,
            totalVotes,
            claimed,
            challengerWon,
            poolEth,
            poolUsd,
            feeBaseWei: BigInt(feeBase ?? 0n),
            feeEth,
            deadline,
            totalSeconds: Math.max(1, Math.max(0, deadline - nowSec())),
          }
        } catch (e) {
          // mark as skipped; we'll report misses
          return { __skip: true }
        }
      })

      const list = rows.filter((r) => r && !r.__skip)
      const missed = rows.filter((r) => r && (r.__skip || r?.__error)).length
      const statusMsg = missed > 0
        ? `Loaded ${list.length} items (${missed} skipped due to RPC timeouts).`
        : ''

      if (controller.signal.aborted) return
      setRounds(list)
      if (statusMsg) setStatus(statusMsg)
      persistCache(list, statusMsg)
    } catch (e) {
      if (String(e?.message).includes('aborted')) return
      console.error('Vote load fatal:', e)
      setStatus('Failed to load votes. Showing cached view (if any).')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [priceUsd, persistCache])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    const t = setInterval(() => { loadAll() }, 60000) // soft auto-refresh
    return () => clearInterval(t)
  }, [loadAll])

  /* ---------------- on-chain refresh for one card ---------------- */
  async function reloadCard(id) {
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true })
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
      const info = await ct.getPool2InfoFull(BigInt(id))

      const originalPool1Id = Number(info.originalPool1Id ?? info[0])
      const challengerWordRaw = info.challengerWord ?? info[1]
      const challengerUsername = info.challengerUsername ?? info[2]
      const claimed = Boolean(info.claimed ?? info[6])
      const challengerWon = Boolean(info.challengerWon ?? info[7])
      const poolBalance = info.poolBalance ?? info[8]
      const feeBase = info.feeBase ?? info[9] ?? info[10]
      const deadline = Number(info.deadline ?? info[10] ?? info[11] ?? 0)

      const votersOriginal = Number(info.votersOriginalCount ?? info[4] ?? 0)
      const votersChallenger = Number(info.votersChallengerCount ?? info[5] ?? 0)
      const totalVotes = Math.max(0, votersOriginal + votersChallenger)

      const p1 = await ct.getPool1Info(BigInt(originalPool1Id))
      const parts = p1.parts_ || p1[2]
      const creatorAddr = p1.creator_ || p1[5]
      const p1CreatorSub = await ct.getPool1Submission(BigInt(originalPool1Id), creatorAddr)
      const originalWordRaw = p1CreatorSub.word || p1CreatorSub[1]

      const poolEth = toEth(poolBalance)
      const poolUsd = poolEth * priceUsd
      const remaining = Math.max(0, deadline - nowSec())

      setRounds((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                originalPool1Id,
                parts,
                originalPreview: buildPreviewFromStored(parts, originalWordRaw),
                originalWordRaw,
                challengerPreview: buildPreviewFromStored(parts, challengerWordRaw),
                challengerWordRaw,
                challengerUsername,
                claimed,
                challengerWon,
                poolEth,
                poolUsd,
                feeBaseWei: BigInt(feeBase ?? 0n),
                feeEth: toEth(feeBase),
                deadline,
                totalVotes,
                totalSeconds: r.totalSeconds || Math.max(1, remaining),
              }
            : r
        )
      )
    } catch {}
  }

  /* ---------------- actions ---------------- */
  async function doVote(id, voteChallenger, feeBaseWei) {
    const before = rounds.find((r) => r.id === id)
    const beforeVotes = before ? before.totalVotes : 0
    try {
      if (!address) await connect()
      setStatus('Submitting vote…')
      await votePool2({ id, voteChallenger, feeWei: feeBaseWei })
      setStatus('✅ Vote recorded!')
      setSuccess(true)
      await reloadCard(id)
      setTimeout(() => setSuccess(false), 1500)
    } catch (e) {
      console.error('Vote error:', e)
      if (isBenignTxError(e)) {
        setStatus('⏳ Submitted, verifying on-chain…')
        await reloadCard(id)
        const after = rounds.find((r) => r.id === id)
        const afterVotes = after ? after.totalVotes : beforeVotes
        if (afterVotes > beforeVotes) {
          setStatus('✅ Vote recorded!')
          setSuccess(true)
          setTimeout(() => setSuccess(false), 1500)
          return
        }
      }
      setStatus('❌ ' + (e?.shortMessage || e?.message || 'Vote failed'))
      setSuccess(false)
    }
  }

  async function doClaim(id) {
    const before = rounds.find((r) => r.id === id)
    const wasClaimed = !!before?.claimed
    try {
      if (!address) await connect()
      setStatus('Claiming…')
      // optimistic mark claimed to mask benign RPC flakes
      setRounds((prev) => prev.map((r) => (r.id === id ? { ...r, claimed: true } : r)))
      await claimPool2(id)
      setClaimedId(id)
      setStatus('✅ Claimed!')
      await reloadCard(id)
      setTimeout(() => setClaimedId(null), 1500)
    } catch (e) {
      console.error('Claim error:', e)
      if (isBenignTxError(e)) {
        setStatus('⏳ Submitted, verifying on-chain…')
        await reloadCard(id)
        const after = rounds.find((r) => r.id === id)
        if ((after?.claimed && !wasClaimed) || wasClaimed) {
          setClaimedId(id)
          setStatus('✅ Claimed!')
          setTimeout(() => setClaimedId(null), 1500)
          return
        }
      }
      // revert if not confirmed
      setRounds((prev) => prev.map((r) => (r.id === id ? { ...r, claimed: wasClaimed } : r)))
      setStatus('❌ ' + (e?.shortMessage || e?.message || 'Error claiming prize'))
    }
  }

  /* ---------------- filters / sorts ---------------- */
  const filtered = useMemo(() => {
    return rounds.filter((r) => {
      if (filter === 'big') return r.poolUsd > 25
      if (filter === 'claimed') return r.deadline > 0 && nowSec() >= r.deadline
      if (filter === 'active') return r.deadline > 0 && nowSec() < r.deadline
      return true
    })
  }, [rounds, filter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === 'votes') return arr.sort((a, b) => b.totalVotes - a.totalVotes)
    if (sortBy === 'prize') return arr.sort((a, b) => b.poolUsd - a.poolUsd)
    return arr.sort((a, b) => b.id - a.id)
  }, [filtered, sortBy])

  /* ---------------- SEO (SSR-safe) ---------------- */
  const pageUrl = absoluteUrl('/vote')
  const ogTitle = 'Community Vote — MadFill'
  const ogDesc = 'Pick the punchline. Vote Original vs Challenger and split the pool with the winners on Base.'
  const ogImage = buildOgUrl({ screen: 'vote', title: 'Community Vote' })

  /* ---------------- UI ---------------- */
  return (
    <Layout>
      <SEO
        title={ogTitle}
        description={ogDesc}
        url={pageUrl}
        image={ogImage}
        type="website"
        twitterCard="summary_large_image"
      />

      <Head>
        {/* Farcaster Frame meta */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="Open Vote" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      {(success || claimedId) && <Confetti width={width} height={height} />}

      <main className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8 py-4 md:py-6 text-white overflow-x-hidden">
        {/* Hero */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight bg-gradient-to-r from-amber-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent break-words min-w-0">
              🗳️ Community Vote
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="text-xs px-2 py-1 border-slate-600"
                onClick={() => { setFilter('all'); setSortBy('recent'); loadAll() }}
                title="Reset filters & reload"
              >
                Reset
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600"
                onClick={loadAll}
                title="Refresh rounds"
              >
                Refresh
              </Button>
              {!isOnBase && (
                <Button
                  onClick={() => !isWarpcast && switchToBase()}
                  disabled={isWarpcast}
                  className="bg-cyan-700 hover:bg-cyan-600 text-sm disabled:opacity-60"
                  aria-label="Switch to Base"
                  title={isWarpcast ? 'Warpcast wallet handles network internally' : 'Switch to Base'}
                >
                  Switch to Base
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-slate-300 max-w-3xl break-words">
            Pick the punchline! Each challenge pits the <span className="font-semibold">Original</span> card against a <span className="font-semibold">Challenger</span>.
            Pay a tiny fee to vote; when voting ends, the winning side <span className="font-semibold">splits the prize pool</span>. Feeling spicy?{' '}
            <Link href="/challenge" className="underline text-purple-300">Submit a Challenger</Link>.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Tip: You can always try to claim once voting is over—the contract will revert if it’s too early.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-300">Filter</label>
            <select
              className="bg-slate-900/70 border border-slate-700 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter voting rounds"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="claimed">Completed</option>
              <option value="big">Big Prize</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-300">Sort</label>
            <select
              className="bg-slate-900/70 border border-slate-700 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort voting rounds"
            >
              <option value="recent">Newest</option>
              <option value="votes">Most Votes</option>
              <option value="prize">Largest Pool</option>
            </select>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="rounded-xl bg-slate-900/70 p-6 animate-pulse text-slate-300 text-center">Loading voting rounds…</div>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl bg-slate-900/70 p-6 text-slate-300 text-center">
            No voting rounds right now.
            <div className="mt-3">
              <Button size="sm" variant="secondary" className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600" onClick={loadAll}>Refresh</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sorted.map((r) => {
              const roundUrl = absoluteUrl(`/round/${r.originalPool1Id}`)

              // Dynamic cast texts for card previews
              const castOriginalText = `😂 Original — Round #${r.originalPool1Id}\n${r.originalPreview}\n\nVote now: ${roundUrl}`
              const castChallengerText = `😆 Challenger — Round #${r.originalPool1Id}${r.challengerUsername ? ` by @${r.challengerUsername}` : ''}\n${r.challengerPreview}\n\nVote now: ${roundUrl}`
              const castGenericText = `Vote on MadFill Challenge #${r.id} (Round #${r.originalPool1Id})`

              const ended = r.deadline > 0 && nowSec() >= r.deadline
              const winnerIsChallenger = ended ? r.challengerWon : null

              return (
                <Card key={r.id} className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700 min-w-0 overflow-hidden">
                  <CardHeader className="flex items-start justify-between gap-2 bg-slate-800/60 border-b border-slate-700 min-w-0">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs"><StatusPill deadline={r.deadline} /></span>
                        <TimeLeft deadline={r.deadline} />
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700">
                          Challenge #{r.id}
                        </span>
                        <Link href={`/round/${r.originalPool1Id}`} className="text-indigo-300 underline text-xs">
                          View Round #{r.originalPool1Id}
                        </Link>
                      </div>
                      <div className="text-lg font-bold truncate">Original vs Challenger</div>
                    </div>
                    <a
                      className="text-indigo-300 underline text-sm shrink-0"
                      href={explorer(`address/${CONTRACT_ADDRESS}`)}
                      target="_blank"
                      rel="noreferrer"
                      title="View contract on BaseScan"
                    >
                      Contract
                    </a>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4 min-w-0 overflow-hidden">
                    {/* Compare */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="relative rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                        {ended && winnerIsChallenger === false && <WinnerBadge />}
                        <div className="text-slate-300 text-sm">😂 Original</div>
                        <div className="mt-1 italic leading-relaxed break-words">
                          <HighlightBlanks text={r.originalPreview} />
                        </div>
                        {/* Share row for Original */}
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="outline"
                            className="border-slate-600 text-slate-200 text-xs"
                            onClick={() => shareOrCast({ text: castOriginalText, url: roundUrl })}
                            title="Cast Original"
                          >
                            Cast Original
                          </Button>
                          <Button
                            variant="outline"
                            className="border-slate-600 text-slate-200 text-xs"
                            onClick={() => shareToX(castOriginalText, roundUrl)}
                            title="Share Original on X"
                          >
                            Share on X
                          </Button>
                        </div>
                      </div>

                      <div id={`ch-${r.id}`} className="relative rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                        {ended && winnerIsChallenger === true && <WinnerBadge />}
                        <div className="text-slate-300 text-sm">
                          😆 Challenger {r.challengerUsername ? <span className="text-slate-400">by @{r.challengerUsername}</span> : null}
                        </div>
                        <div className="mt-1 italic leading-relaxed break-words">
                          <HighlightBlanks text={r.challengerPreview} />
                        </div>
                        {/* Share row for Challenger */}
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="outline"
                            className="border-slate-600 text-slate-200 text-xs"
                            onClick={() => shareOrCast({ text: castChallengerText, url: roundUrl })}
                            title="Cast Challenger"
                          >
                            Cast Challenger
                          </Button>
                          <Button
                            variant="outline"
                            className="border-slate-600 text-slate-200 text-xs"
                            onClick={() => shareToX(castChallengerText, roundUrl)}
                            title="Share Challenger on X"
                          >
                            Share on X
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Pool: {fmt(r.poolEth, 6)} ETH (~${fmt(r.poolUsd)})
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Votes: {r.totalVotes}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Fee: {fmt(r.feeEth, 6)} ETH
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                      {!ended ? (
                        <>
                          <Button onClick={() => doVote(r.id, true, r.feeBaseWei)} className="bg-blue-600 hover:bg-blue-500">
                            Vote Challenger
                          </Button>
                          <Button onClick={() => doVote(r.id, false, r.feeBaseWei)} className="bg-green-600 hover:bg-green-500">
                            Vote Original
                          </Button>
                          <a
                            href={`#ch-${r.id}`}
                            className="underline text-purple-300 text-sm"
                            title="Jump to the challenger card"
                          >
                            View Challenger Card
                          </a>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-slate-300">🏁 Voting Ended</span>
                          <Button
                            onClick={() => doClaim(r.id)}
                            disabled={r.claimed}
                            className={`${r.claimed ? 'bg-slate-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                            title={r.claimed ? 'Already claimed' : 'Claim your share if you were on the winning side'}
                          >
                            {r.claimed ? 'Already Claimed' : 'Claim winnings'}
                          </Button>
                        </>
                      )}

                      {/* Generic social using shareOrCast to avoid Warpcast install page */}
                      <div className="ml-auto flex items-center gap-2 min-w-0">
                        <Button
                          className="px-3 py-2 rounded-md bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs shrink-0"
                          onClick={() => shareOrCast({ text: castGenericText, url: roundUrl })}
                          title="Cast"
                        >
                          Cast
                        </Button>
                        <Button
                          variant="outline"
                          className="border-slate-600 text-slate-200 text-xs"
                          onClick={() => shareToX(castGenericText, roundUrl)}
                          title="Share on X"
                        >
                          Share on X
                        </Button>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Vote fee comes from each challenge’s on-chain <code>feeBase</code>. We add a tiny buffer on send to avoid rounding reverts.
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {status && <div className="mt-6 text-center text-yellow-300" aria-live="polite">{status}</div>}

        {/* Footer */}
        <footer className="mt-10 text-xs text-slate-400 flex flex-wrap items-center gap-3 justify-between border-t border-slate-800 pt-4">
          <div className="flex items-center gap-3">
            <Link href="/challenge" className="underline text-indigo-300">Start a Challenge</Link>
            <a
              href={explorer(`address/${CONTRACT_ADDRESS}`)}
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
