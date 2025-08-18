// pages/vote.jsx
'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'
import dynamic from 'next/dynamic'

import Layout from '@/components/Layout'
import SEO from '@/components/SEO'
import ShareBar from '@/components/ShareBar'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryV3_ABI.json'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import { useTx } from '@/components/TxProvider'

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

// ---- Config ----
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

// small util
const nowSec = () => Math.floor(Date.now() / 1000)

// --- tiny live countdown pill (text only) ---
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
    const id = setInterval(() => {
      setLeft(Math.max(0, (deadline || 0) - nowSec()))
    }, 1000)
    return () => clearInterval(id)
  }, [deadline])
  if (!deadline || left <= 0) return null
  return (
    <span
      className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[11px] font-medium whitespace-nowrap"
      title={`${left} seconds left`}
    >
      ⏳ {formatRemaining(left)} left
    </span>
  )
}

export default function VotePage() {
  useMiniAppReady()

  // from TxProvider
  const {
    address,
    isOnBase,
    isWarpcast,
    connect,
    switchToBase,
    votePool2,
    claimPool2,
  } = useTx()

  // state
  const [rounds, setRounds] = useState([]) // Pool2 cards
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [success, setSuccess] = useState(false)
  const [claimedId, setClaimedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [priceUsd, setPriceUsd] = useState(3800)

  const { width, height } = useWindowSize()
  const tickRef = useRef(null)

  // ---- utils ----
  const toEth = (wei) => (wei ? Number(ethers.formatEther(wei)) : 0)
  const fmt = (n, d = 2) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n)
  const explorer = (path) => `https://basescan.org/${path}`

  const benignPatterns = [
    /could not coalesce/i,
    /already known/i,
    /replacement transaction underpriced/i,
    /nonce .* too low/i,
    /fee too low/i,
    /transaction (?:not )?mined/i, // flaky nodes
  ]
  const isBenignTxError = (e) => {
    const msg = String(e?.shortMessage || e?.message || e || '')
    return benignPatterns.some((re) => re.test(msg))
  }

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
  const needsSpaceBefore = (str) =>
    !( /\s/.test(str?.[0]) || /[.,!?;:)"'\]]/.test(str?.[0]) )

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
  function buildPreviewFromStored(parts, stored) {
    const { index, word } = parseStoredWord(stored)
    return buildPreviewSingle(parts, word, index)
  }

  // ---- price + ticker ----
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const j = await r.json()
        setPriceUsd(j?.ethereum?.usd || 3800)
      } catch {
        setPriceUsd(3800)
      }
    })()
    tickRef.current = setInterval(() => setStatus((s) => (s ? s : '')), 1000)
    return () => clearInterval(tickRef.current)
  }, [])

  // ---- load Pool2 list + previews (with retry/backoff & abort) ----
  const abortRef = useRef(null)

  const loadAll = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setStatus('')

    const provider = new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true })
    const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)

    // tiny helper to retry calls
    const retry = async (fn, tries = 3) => {
      let lastErr
      for (let i = 0; i < tries; i++) {
        try {
          if (controller.signal.aborted) throw new Error('aborted')
          return await fn()
        } catch (e) {
          lastErr = e
          await new Promise(res => setTimeout(res, 200 * (i + 1)))
        }
      }
      throw lastErr
    }

    try {
      const p2Count = Number(await retry(() => ct.pool2Count()))
      if (controller.signal.aborted) return

      if (!p2Count) {
        setRounds([])
        return
      }

      // Limit parallelism for stability
      const ids = Array.from({ length: p2Count }, (_, i) => i + 1)
      const chunk = (arr, n) => arr.length ? [arr.slice(0, n), ...chunk(arr.slice(n), n)] : []
      const chunks = chunk(ids.reverse(), 25) // pull newest first, 25 at a time

      const results = []
      for (const group of chunks) {
        const infos = await Promise.allSettled(
          group.map((id) =>
            retry(() => ct.getPool2InfoFull(BigInt(id))).then((info) => ({ id, info }))
          )
        )
        for (const r of infos) if (r.status === 'fulfilled') results.push(r.value)
        if (controller.signal.aborted) return
      }

      // hydrate each with its Pool1 + original submission
      const enriched = await Promise.all(results.map(async ({ id, info }) => {
        const originalPool1Id = Number(info.originalPool1Id ?? info[0])
        const challengerWordRaw = info.challengerWord ?? info[1]
        const challengerUsername = info.challengerUsername ?? info[2]
        const challengerAddr = info.challenger ?? info[3]
        const votersOriginal = Number(info.votersOriginalCount ?? info[4])
        const votersChallenger = Number(info.votersChallengerCount ?? info[5])
        const claimed = Boolean(info.claimed ?? info[6])
        const challengerWon = Boolean(info.challengerWon ?? info[7])
        const poolBalance = info.poolBalance ?? info[8]
        const feeBase = info.feeBase ?? info[9] ?? info[10]
        const deadline = Number(info.deadline ?? info[10] ?? info[11] ?? 0)

        const p1 = await retry(() => ct.getPool1Info(BigInt(originalPool1Id)))
        const parts = p1.parts_ || p1[2]
        const creatorAddr = p1.creator_ || p1[5]
        const p1CreatorSub = await retry(() =>
          ct.getPool1Submission(BigInt(originalPool1Id), creatorAddr)
        )
        const originalWordRaw = p1CreatorSub.word || p1CreatorSub[1]

        const originalPreview = buildPreviewFromStored(parts, originalWordRaw)
        const challengerPreview = buildPreviewFromStored(parts, challengerWordRaw)

        const poolEth = toEth(poolBalance)
        const poolUsd = poolEth * priceUsd
        const feeEth = toEth(feeBase)

        const remaining = Math.max(0, deadline - nowSec())
        const totalSeconds = Math.max(1, remaining)

        return {
          id,
          originalPool1Id,
          parts,
          originalPreview,
          originalWordRaw,
          challengerPreview,
          challengerWordRaw,
          challengerUsername,
          challengerAddr,
          votersOriginal,
          votersChallenger,
          claimed,
          challengerWon,
          poolEth,
          poolUsd,
          feeBaseWei: BigInt(feeBase ?? 0n),
          feeEth,
          deadline,
          totalSeconds,
        }
      }))

      // newest first
      setRounds(enriched.sort((a, b) => b.id - a.id))
    } catch (e) {
      console.error('Error loading vote rounds', e)
      setRounds([])
      setStatus('Could not load voting rounds. Try Refresh.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [priceUsd])

  useEffect(() => { loadAll() }, [loadAll])

  // ---- actions (use TxProvider) ----
  async function doVote(id, voteChallenger, feeBaseWei) {
    const before = rounds.find((r) => r.id === id)
    const beforeVotes = before ? before.votersOriginal + before.votersChallenger : 0

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
        // Optimistic verify on-chain
        setStatus('⏳ Submitted, verifying on-chain…')
        await reloadCard(id)
        const after = rounds.find((r) => r.id === id)
        const afterVotes = after ? after.votersOriginal + after.votersChallenger : beforeVotes
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
    // snapshot claimed state
    const before = rounds.find((r) => r.id === id)
    const wasClaimed = !!before?.claimed

    try {
      if (!address) await connect()
      setStatus('Claiming…')

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
        if (after?.claimed && !wasClaimed) {
          setClaimedId(id)
          setStatus('✅ Claimed!')
          setTimeout(() => setClaimedId(null), 1500)
          return
        }
      }
      setStatus('❌ ' + (e?.shortMessage || e?.message || 'Error claiming prize'))
    }
  }

  async function reloadCard(id) {
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC)
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
      const info = await ct.getPool2InfoFull(BigInt(id))

      const originalPool1Id = Number(info.originalPool1Id ?? info[0])
      const challengerWordRaw = info.challengerWord ?? info[1]
      const challengerUsername = info.challengerUsername ?? info[2]
      const challengerAddr = info.challenger ?? info[3]
      const votersOriginal = Number(info.votersOriginalCount ?? info[4])
      const votersChallenger = Number(info.votersChallengerCount ?? info[5])
      const claimed = Boolean(info.claimed ?? info[6])
      const challengerWon = Boolean(info.challengerWon ?? info[7])
      const poolBalance = info.poolBalance ?? info[8]
      const feeBase = info.feeBase ?? info[9] ?? info[10]
      const deadline = Number(info.deadline ?? info[10] ?? info[11] ?? 0)

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
                challengerAddr,
                votersOriginal,
                votersChallenger,
                claimed,
                challengerWon,
                poolEth,
                poolUsd,
                feeBaseWei: BigInt(feeBase ?? 0n),
                feeEth: toEth(feeBase),
                deadline,
                totalSeconds: r.totalSeconds || Math.max(1, remaining),
              }
            : r
        )
      )
    } catch {
      // ignore
    }
  }

  // ---- filters / sorts ----
  const filtered = useMemo(() => {
    return rounds.filter((r) => {
      if (filter === 'big') return r.poolUsd > 25
      if (filter === 'tight') return Math.abs(r.votersOriginal - r.votersChallenger) <= 2
      if (filter === 'claimed') return r.claimed
      if (filter === 'active') return !r.claimed
      return true
    })
  }, [rounds, filter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === 'votes')
      return arr.sort(
        (a, b) =>
          b.votersOriginal + b.votersChallenger - (a.votersOriginal + a.votersChallenger)
      )
    if (sortBy === 'prize') return arr.sort((a, b) => b.poolUsd - a.poolUsd)
    return arr.sort((a, b) => b.id - a.id) // recent
  }, [filtered, sortBy])

  // ---- SEO (SSR-safe) ----
  const pageUrl = absoluteUrl('/vote')
  const ogTitle = 'Community Vote — MadFill'
  const ogDesc =
    'Pick the punchline. Vote Original vs Challenger and split the pool with the winners on Base.'
  const ogImage = buildOgUrl({ screen: 'vote', title: 'Community Vote' })

  function StatusPill({ claimed, challengerWon }) {
    if (!claimed)
      return (
        <span className="px-2 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs">
          Voting
        </span>
      )
    return (
      <span className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs">
        {challengerWon ? 'Challenger Won' : 'Original Won'}
      </span>
    )
  }

  // ---- UI ----
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
        {/* Farcaster Mini App / Frame meta */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="Open Vote" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      {(success || claimedId) && <Confetti width={width} height={height} />}

      {/* --- CONTAINER + OVERFLOW FIXES --- */}
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
              <option value="tight">Close Vote</option>
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
              <option value="votes">Top Votes</option>
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
              const shareUrl = absoluteUrl(`/round/${r.originalPool1Id}`)
              const shareText = `Vote on MadFill Challenge #${r.id} → Round #${r.originalPool1Id}!`
              return (
                <Card key={r.id} className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700 min-w-0 overflow-hidden">
                  <CardHeader className="flex items-start justify-between gap-2 bg-slate-800/60 border-b border-slate-700 min-w-0">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs"><StatusPill claimed={r.claimed} challengerWon={r.challengerWon} /></span>
                        {!r.claimed && r.deadline > 0 && <TimeLeft deadline={r.deadline} />}
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

                  <CardContent className="p-5 space-y-3 min-w-0 overflow-hidden">
                    {/* Compare */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                        <div className="text-slate-300 text-sm">😂 Original</div>
                        <div className="mt-1 italic leading-relaxed break-words">{r.originalPreview}</div>
                      </div>
                      <div id={`ch-${r.id}`} className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                        <div className="text-slate-300 text-sm">
                          😆 Challenger {r.challengerUsername ? <span className="text-slate-400">by @{r.challengerUsername}</span> : null}
                        </div>
                        <div className="mt-1 italic leading-relaxed break-words">{r.challengerPreview}</div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Pool: {fmt(r.poolEth, 6)} ETH (~${fmt(r.poolUsd)})
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Votes — Orig: {r.votersOriginal} • Chall: {r.votersChallenger}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Fee: {fmt(r.feeEth, 6)} ETH
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                      {!r.claimed ? (
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
                            title="Jump to the challenger card in this challenge"
                          >
                            View Challenger Card
                          </a>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-slate-300">🏁 Voting Ended</span>
                          <Button onClick={() => doClaim(r.id)} className="bg-indigo-600 hover:bg-indigo-500">
                            Claim (if you were on the winning side)
                          </Button>
                        </>
                      )}

                      {/* Social */}
                      <div className="ml-auto min-w-0">
                        <ShareBar
                          url={shareUrl}
                          text={shareText}
                          small
                          className="min-w-0"
                          og={{ screen: 'round', roundId: String(r.originalPool1Id) }}
                        />
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
