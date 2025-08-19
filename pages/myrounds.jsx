// pages/myrounds.jsx
'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import Link from 'next/link'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'

import Layout from '@/components/Layout'
import SEO from '@/components/SEO'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ShareBar from '@/components/ShareBar'
import Countdown from '@/components/Countdown'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import { useTx } from '@/components/TxProvider'
import fillAbi from '@/abi/FillInStoryV3_ABI.json'
import { openCast } from '@/lib/share' // still used as a JS fallback

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

/* ---------------- utils ---------------- */
const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
const toEth = (wei) => { try { return Number(ethers.formatEther(wei ?? 0n)) } catch { return 0 } }
const fmt = (n, d = 2) => new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(Number(n || 0))
const needsSpaceBefore = (str) => !!str && !/\s|[.,!?;:)"'\]]/.test(str[0])
const buildPreviewSingle = (parts, word, blankIndex) => {
  const n = parts?.length || 0
  if (!n) return ''
  const blanks = Math.max(0, n - 1)
  const idx = Math.max(0, Math.min(blanks - 1, Number(blankIndex) || 0))
  const out = []
  for (let i = 0; i < n; i++) {
    out.push(parts[i] || '')
    if (i < n - 1) out.push(i === idx ? (word ? word + (needsSpaceBefore(parts[i + 1]) ? ' ' : '') : '____') : '____')
  }
  return out.join('')
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Build a pretty template view (parts + highlighted blank chips) */
function renderTemplateParts(parts = [], blankChip = '[BLANK]') {
  const nodes = []
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) nodes.push(<span key={`p-${i}`}>{parts[i]}</span>)
    if (i < parts.length - 1) {
      nodes.push(
        <span
          key={`b-${i}`}
          className="mx-1 inline-flex items-center rounded-md px-2 py-0.5 text-xs md:text-sm font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/30"
        >
          {blankChip}
        </span>
      )
    }
  }
  return nodes
}

/** Reconstruct a plain-text version (for casting text-only) */
function composeTemplateText(parts = [], blank = '[BLANK]') {
  if (!Array.isArray(parts) || parts.length === 0) return ''
  const out = []
  for (let i = 0; i < parts.length; i++) {
    out.push(parts[i] || '')
    if (i < parts.length - 1) out.push(` ${blank} `)
  }
  return out.join('').replace(/\s+/g, ' ').trim()
}

function truncateForCast(s, max = 280) {
  if (!s) return ''
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

const formatTimeLeft = (deadlineSec) => {
  const now = Math.floor(Date.now() / 1000)
  const diff = Math.max(0, Number(deadlineSec || 0) - now)
  if (diff === 0) return 'Ended'
  const d = Math.floor(diff / 86400), h = Math.floor((diff % 86400) / 3600), m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/* ------------- retry + concurrency ------------- */
async function withRetry(fn, { tries = 4, minDelay = 150, maxDelay = 800, signal } = {}) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    if (signal?.aborted) throw new Error('aborted')
    try { return await fn() } catch (e) {
      lastErr = e
      const msg = String(e?.message || e)
      if (/aborted|revert|CALL_EXCEPTION/i.test(msg)) break
      const backoff = Math.min(maxDelay, minDelay * Math.pow(2, i))
      const jitter = Math.floor(Math.random() * 80)
      await sleep(backoff + jitter)
    }
  }
  throw lastErr
}
function mapLimit(items, limit, worker) {
  let i = 0
  const results = new Array(items.length)
  let active = 0
  return new Promise((resolve) => {
    const next = () => {
      if (i >= items.length && active === 0) return resolve(results)
      while (active < limit && i < items.length) {
        const idx = i++
        active++
        Promise.resolve(worker(items[idx], idx))
          .then((res) => { results[idx] = res })
          .catch((err) => { results[idx] = { __error: err } })
          .finally(() => { active--; next() })
      }
    }
    next()
  })
}
const CONCURRENCY = 8

/* ------------- NFT read ABI (balance/owner for discovery) ------------- */
const NFT_READ_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)'
]

/* ------------- URL helpers ------------- */
const ipfsToHttp = (u) => {
  if (!u) return u
  if (u.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${u.slice('ipfs://'.length)}`
  return u
}

/* ------------- tiny UI helpers ------------- */
function StatCard({ label, value, className = '' }) {
  return (
    <div className={`rounded-xl bg-slate-900/60 border border-slate-700 p-4 ${className}`}>
      <div className="text-slate-400 text-xs">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  )
}
function statusBadge(card) {
  if (card.kind === 'pool2') {
    if (card.claimed) return <span className="inline-block px-2 py-0.5 rounded bg-emerald-700/40 text-emerald-200 text-xs">Claimed</span>
    if (card.challengerWon) return <span className="inline-block px-2 py-0.5 rounded bg-indigo-700/40 text-indigo-200 text-xs">Challenger won</span>
    return <span className="inline-block px-2 py-0.5 rounded bg-slate-700/40 text-slate-200 text-xs">Voting</span>
  }
  if (card.claimed) return <span className="inline-block px-2 py-0.5 rounded bg-emerald-700/40 text-emerald-200 text-xs">Claimed</span>
  if (card.ended) {
    return card.youWon
      ? <span className="inline-block px-2 py-0.5 rounded bg-yellow-600/40 text-yellow-200 text-xs">You won</span>
      : <span className="inline-block px-2 py-0.5 rounded bg-slate-700/40 text-slate-200 text-xs">Ended</span>
  }
  return <span className="inline-block px-2 py-0.5 rounded bg-cyan-700/40 text-cyan-200 text-xs">Active</span>
}

/* --------- Transfer-log scan for non-enumerable/sparse IDs --------- */
async function findTokenIdsByLogs({ provider, nft, address, maxBack = 1_200_000, chunk = 40_000 }) {
  try {
    const latest = await provider.getBlockNumber()
    const start = Math.max(0, latest - maxBack)
    const iface = new ethers.Interface(NFT_READ_ABI)
    const topicTransfer = iface.getEvent('Transfer').topicHash
    const addrTopic = ethers.zeroPadValue(address, 32).toLowerCase()

    const seen = new Set()

    for (let to = latest; to > start; to -= chunk) {
      const from = Math.max(start, to - chunk + 1)
      const logs = await provider.getLogs({
        address: nft.target || nft.address,
        fromBlock: from,
        toBlock: to,
        topics: [topicTransfer, null, addrTopic],
      })
      for (const log of logs) {
        try {
          const parsed = iface.parseLog(log)
          const tid = Number(parsed.args.tokenId)
          seen.add(tid)
        } catch {}
      }
    }

    // Confirm current ownership
    const tokenIds = Array.from(seen)
    const confirmed = []
    for (const tid of tokenIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const who = await nft.ownerOf(tid)
        if (who && who.toLowerCase() === address.toLowerCase()) confirmed.push(tid)
      } catch {}
    }
    return confirmed.sort((a, b) => a - b)
  } catch {
    return []
  }
}

/* Cast helpers */
function buildWarpcastUrl({ text, embeds = [] }) {
  const base = 'https://warpcast.com/~/compose'
  const params = new URLSearchParams()
  if (text) params.set('text', text)
  for (const e of embeds) params.append('embeds[]', e)
  return `${base}?${params.toString()}`
}

/* ------------- component ------------- */
function MyRoundsPage() {
  useMiniAppReady()
  const { width, height } = useWindowSize()
  const {
    address, isConnected, isOnBase, connect, switchToBase,
    claimPool1,
    BASE_RPC, FILLIN_ADDRESS, NFT_ADDRESS,

    // TxProvider read helpers
    readTemplateOf, readTokenURI, readNftLimits,
  } = useTx()

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [priceUsd, setPriceUsd] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)

  const [started, setStarted] = useState([])
  const [joined, setJoined] = useState([])
  const [wins, setWins] = useState([])
  const [unclaimedWins, setUnclaimedWins] = useState([])
  const [voted, setVoted] = useState([])

  // NFTs
  const [nfts, setNfts] = useState([])
  const [nftLoading, setNftLoading] = useState(false)
  const [blankToken, setBlankToken] = useState('[BLANK]') // default visible chip text

  // filters
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [activeTab, setActiveTab] = useState('stats')

  // Abort controller for loads
  const abortRef = useRef(null)

  // ---- Local cache for resilience
  const cacheKey = useMemo(() => address ? `myrounds:${FILLIN_ADDRESS}:${address.toLowerCase()}` : null, [address, FILLIN_ADDRESS])
  const cacheNftKey = useMemo(() => address && NFT_ADDRESS ? `mynfts:${NFT_ADDRESS}:${address.toLowerCase()}` : null, [address, NFT_ADDRESS])

  const hydrateFromCache = useCallback(() => {
    try {
      if (!cacheKey) return
      const j = JSON.parse(localStorage.getItem(cacheKey) || '{}')
      if (!j || !j.data) return
      setStarted(j.data.started || [])
      setJoined(j.data.joined || [])
      setWins((j.data.wins || []))
      setUnclaimedWins(j.data.unclaimedWins || [])
      setVoted(j.data.voted || [])
    } catch {}
  }, [cacheKey])

  const persistCache = useCallback((payload) => {
    try {
      if (!cacheKey) return
      localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: payload }))
    } catch {}
  }, [cacheKey])

  const hydrateNftsFromCache = useCallback(() => {
    try {
      if (!cacheNftKey) return
      const j = JSON.parse(localStorage.getItem(cacheNftKey) || '{}')
      if (!j || !j.data) return
      setNfts(j.data || [])
    } catch {}
  }, [cacheNftKey])

  const persistNftCache = useCallback((list) => {
    try {
      if (!cacheNftKey) return
      localStorage.setItem(cacheNftKey, JSON.stringify({ at: Date.now(), data: list }))
    } catch {}
  }, [cacheNftKey])

  useEffect(() => { hydrateFromCache(); hydrateNftsFromCache() }, [hydrateFromCache, hydrateNftsFromCache])

  // price (display only) with fallback + retry
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const tryOnce = async (url) => {
          const r = await fetch(url); return await r.json()
        }
        let usd = 0
        try {
          const j = await tryOnce('https://api.coinbase.com/v2/prices/ETH-USD/spot')
          usd = Number(j?.data?.amount || 0)
        } catch {}
        if (!usd) {
          try {
            const j = await tryOnce('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
            usd = Number(j?.ethereum?.usd || 0)
          } catch {}
        }
        if (!dead) setPriceUsd(usd || 0)
      } catch { if (!dead) setPriceUsd(0) }
    })()
    return () => { dead = true }
  }, [])

  // provider/contract (read-only)
  const getRead = useCallback(() => {
    const provider = new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true })
    const ct = new ethers.Contract(FILLIN_ADDRESS, fillAbi, provider)
    return { provider, ct }
  }, [BASE_RPC, FILLIN_ADDRESS])

  // load rounds (robust + cache)
  const loadMyRounds = useCallback(async () => {
    if (!address) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    setLoading(true); setStatus('')
    try {
      const { ct } = getRead()

      let userEntries
      try {
        userEntries = await withRetry(() => ct.getUserEntries(address), { signal })
      } catch {
        setStatus('Network hiccup loading entries — using cached view where available.')
        setLoading(false)
        return
      }

      const ids1 = Array.from(userEntries?.[0] || []).map(Number)
      const ids2 = Array.from(userEntries?.[1] || []).map(Number)

      const p1CardsRaw = await mapLimit(ids1, CONCURRENCY, async (id) => {
        if (signal.aborted) return null
        try {
          const info = await withRetry(() => ct.getPool1Info(BigInt(id)), { signal })
          const name = info.name_ ?? info[0]
          const theme = info.theme_ ?? info[1]
          const parts = info.parts_ ?? info[2] ?? []
          const feeBase = info.feeBase_ ?? info[3] ?? 0n
          const deadline = Number(info.deadline_ ?? info[4] ?? 0)
          const creator = (info.creator_ ?? info[5] ?? '').toString()
          const participants = info.participants_ ?? info[6] ?? []
          const winner = info.winner_ ?? info[7] ?? '0x0000000000000000000000000000000000000000'
          const claimed = Boolean(info.claimed_ ?? info[8])
          const poolBalance = info.poolBalance_ ?? info[9] ?? 0n

          const your = await withRetry(
            () => ct.getPool1Submission(BigInt(id), address),
            { tries: 2, minDelay: 120, maxDelay: 300, signal }
          ).catch(() => null)

          const yourUsername = your?.username ?? your?.[0] ?? ''
          const yourWord = your?.word ?? your?.[1] ?? ''
          const yourBlank = Number(your?.blankIndex ?? your?.[3] ?? 0)

          const now = Math.floor(Date.now() / 1000)
          const ended = now >= deadline
          const youWon = String(winner).toLowerCase() === String(address).toLowerCase()

          return {
            kind: 'pool1',
            id: Number(id),
            name, theme,
            parts: Array.isArray(parts) ? parts : [],
            preview: buildPreviewSingle(parts, yourWord, yourBlank),
            word: yourWord, username: yourUsername, blankIndex: yourBlank,
            feeEth: toEth(feeBase),
            feeUsd: toEth(feeBase) * priceUsd,
            poolEth: toEth(poolBalance),
            poolUsd: toEth(poolBalance) * priceUsd,
            deadline, creator,
            participantsCount: participants?.length || 0,
            winner, claimed, ended, youWon,
            isCreator: creator && creator.toLowerCase() === address.toLowerCase(),
          }
        } catch { return null }
      })
      const p1Cards = p1CardsRaw.filter(Boolean)
      const startedCards = p1Cards.filter((c) => c.isCreator)
      const winCards = p1Cards.filter((c) => c.youWon)
      const unclaimed = winCards.filter((c) => !c.claimed)

      const p2CardsRaw = await mapLimit(ids2, CONCURRENCY, async (id) => {
        if (signal.aborted) return null
        try {
          const p2 = await withRetry(() => ct.getPool2InfoFull(BigInt(id)), { signal })
          const originalId = Number(p2.originalPool1Id ?? p2[0])
          const chWord = p2.challengerWord ?? p2[1]
          const chUsername = p2.challengerUsername ?? p2[2]
          const votersOriginalCount = Number(p2.votersOriginalCount ?? p2[4] ?? 0)
          const votersChallengerCount = Number(p2.votersChallengerCount ?? p2[5] ?? 0)
          const claimed = Boolean(p2.claimed ?? p2[6])
          const challengerWon = Boolean(p2.challengerWon ?? p2[7])
          const poolEth = toEth(p2.poolBalance ?? p2[8] ?? 0n)
          const feeBase = toEth(p2.feeBase ?? p2[9] ?? 0n)
          const deadline = Number(p2.deadline ?? p2[10] ?? 0)

          const info = await withRetry(() => ct.getPool1Info(BigInt(originalId)), { signal })
          const parts = info.parts_ ?? info[2] ?? []
          const creatorAddr = (info.creator_ ?? info[5] ?? '').toString()
          const creatorSub = await withRetry(
            () => ct.getPool1Submission(BigInt(originalId), creatorAddr),
            { tries: 2, minDelay: 120, maxDelay: 300, signal }
          ).catch(() => null)
          const creatorBlank = Number(creatorSub?.blankIndex ?? creatorSub?.[3] ?? 0)

          return {
            kind: 'pool2',
            id: Number(id),
            originalPool1Id: originalId,
            chUsername, chWord,
            chPreview: buildPreviewSingle(parts, chWord, creatorBlank),
            votersOriginal: votersOriginalCount,
            votersChallenger: votersChallengerCount,
            claimed, challengerWon,
            poolEth, poolUsd: poolEth * priceUsd, feeBase, deadline,
          }
        } catch { return null }
      })
      const p2Cards = p2CardsRaw.filter(Boolean)

      if (signal.aborted) return
      setJoined(p1Cards); setStarted(startedCards); setWins(winCards); setUnclaimedWins(unclaimed); setVoted(p2Cards)
      persistCache({ started: startedCards, joined: p1Cards, wins: winCards, unclaimedWins: unclaimed, voted: p2Cards })

      const missed = (ids1.length - p1Cards.length) + (ids2.length - p2Cards.length)
      if (missed > 0) setStatus(`Loaded ${ids1.length + ids2.length - missed} items (${missed} skipped due to RPC timeouts).`)
    } catch (e) {
      if (String(e?.message).includes('aborted')) return
      console.error(e)
      setStatus('Failed to load your rounds. Showing cached view (if any).')
    } finally {
      if (!abortRef.current?.signal?.aborted) setLoading(false)
    }
  }, [address, getRead, priceUsd, persistCache])

  useEffect(() => { if (address) loadMyRounds() }, [address, loadMyRounds])
  useEffect(() => {
    if (!address) return
    const t = setInterval(() => { loadMyRounds() }, 60000)
    return () => clearInterval(t)
  }, [address, loadMyRounds])

  // claim / finalize
  const finalizePool1 = useCallback(async (id) => {
    try {
      setStatus('Finalizing round…')
      await claimPool1(id)
      setStatus('Finalized')
      setShowConfetti(true)
      setJoined((rs) => rs.map((r) => (r.id === id ? { ...r, claimed: true } : r)))
      setWins((rs) => rs.map((r) => (r.id === id ? { ...r, claimed: true } : r)))
      setUnclaimedWins((rs) => rs.filter((r) => r.id !== id))
      setTimeout(() => setShowConfetti(false), 1800)
    } catch (e) {
      console.error(e)
      const msg = e?.info?.error?.message || e?.shortMessage || e?.reason || e?.message || 'Finalize failed'
      setStatus(msg); setShowConfetti(false)
    }
  }, [claimPool1])

  /* ------------- NFTs ------------- */
  async function fetchJson(uri) {
    try {
      if (!uri) return null
      if (uri.startsWith('data:')) {
        const[,payload] = uri.split(',', 2)
        const json = JSON.parse(decodeURIComponent(payload))
        return json
      }
      const res = await fetch(ipfsToHttp(uri))
      return await res.json()
    } catch { return null }
  }

  // pull BLANK token label once (use readable token for UI; keep default if not available)
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const lim = await readNftLimits?.()
        // contract BLANK might be something like "[BLANK]" or custom; fall back to readable "[BLANK]"
        const v = String(lim?.BLANK ?? '').trim()
        if (!dead && v) setBlankToken(v)
      } catch {}
    })()
    return () => { dead = true }
  }, [readNftLimits])

  const loadMyNfts = useCallback(async () => {
    if (!address || !NFT_ADDRESS) { setNfts([]); return }
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    setNftLoading(true)
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true })
      const nft = new ethers.Contract(NFT_ADDRESS, NFT_READ_ABI, provider)

      const bal = Number(await withRetry(() => nft.balanceOf(address), { signal }).catch(() => 0n))
      if (!bal) { setNfts([]); persistNftCache([]); return }

      let tokens = []
      let enumerableWorked = true

      // 1) Enumerable lookup
      for (let i = 0; i < bal; i++) {
        try {
          const tid = await withRetry(() => nft.tokenOfOwnerByIndex(address, i), { tries: 2, signal })
          tokens.push(Number(tid))
        } catch { enumerableWorked = false; break }
      }

      // 2) Small brute force (for tiny collections)
      if (!enumerableWorked && tokens.length < bal) {
        const total = Number(await withRetry(() => nft.totalSupply(), { signal }).catch(() => 0n))
        const cap = Math.min(total || 0, 400)
        for (let tid = 1; tokens.length < bal && tid <= cap; tid++) {
          // eslint-disable-next-line no-await-in-loop
          const who = await withRetry(() => nft.ownerOf(tid), { tries: 2, signal }).catch(() => null)
          if (signal.aborted) return
          if (who && who.toLowerCase() === address.toLowerCase()) tokens.push(tid)
        }
      }

      // 3) Transfer logs scan (handles sparse IDs)
      if (tokens.length < bal) {
        const viaLogs = await findTokenIdsByLogs({ provider, nft, address })
        for (const t of viaLogs) if (!tokens.includes(t)) tokens.push(t)
      }

      tokens = Array.from(new Set(tokens)).sort((a, b) => a - b)

      // Enrich: tokenURI + templateOf. Also compute polished view data.
      const enriched = await mapLimit(tokens, 6, async (id) => {
        if (signal.aborted) return { id }
        try {
          const [uri, tpl] = await Promise.all([
            withRetry(() => readTokenURI(BigInt(id)), { tries: 3, signal }).catch(() => null),
            withRetry(() => readTemplateOf(BigInt(id)), { tries: 3, signal }).catch(() => null),
          ])

          const meta = await fetchJson(uri)
          const ipfsImg = meta?.image || meta?.image_url || ''
          const image =
            ipfsToHttp(ipfsImg) ||
            (ipfsImg && `https://cloudflare-ipfs.com/ipfs/${ipfsImg.replace('ipfs://','')}`) ||
            (ipfsImg && `https://w3s.link/ipfs/${ipfsImg.replace('ipfs://','')}`)

          const name = meta?.name || tpl?.title || `Template #${id}`
          const desc = meta?.description || tpl?.description || ''
          const theme = tpl?.theme || meta?.attributes?.find?.(a => a?.trait_type === 'theme')?.value || ''
          const parts = Array.isArray(tpl?.parts) ? tpl.parts : []
          const plainTemplate = composeTemplateText(parts, blankToken)

          return {
            id, tokenURI: uri,
            meta, image, name, desc, theme, parts,
            plainTemplate, // for cast text
          }
        } catch {
          return { id, tokenURI: null }
        }
      })

      if (signal.aborted) return
      setNfts(enriched)
      persistNftCache(enriched)
    } catch (e) {
      if (!String(e?.message).includes('aborted')) console.error(e)
    } finally {
      if (!abortRef.current?.signal?.aborted) setNftLoading(false)
    }
  }, [address, BASE_RPC, NFT_ADDRESS, persistNftCache, readTemplateOf, readTokenURI, blankToken])

  useEffect(() => { if (address) loadMyNfts() }, [address, loadMyNfts])

  // ---- Cast a single template (as link + JS fallback) ----
  const buildTemplateCastText = useCallback((tpl) => {
    if (!tpl) return ''
    const header = tpl.name ? `🎨 ${tpl.name}` : `🎨 MadFill Template #${tpl.id}`
    const themeLine = tpl.theme ? `Theme: ${tpl.theme}\n` : ''
    const body = tpl.plainTemplate || ''
    return truncateForCast(`${header}\n${themeLine}${body}`, 280)
  }, [])

  const tryOpenCast = useCallback((tpl) => {
    const text = buildTemplateCastText(tpl)
    try {
      // fallback to JS-based share if available
      openCast?.({ text, embeds: [] })
    } catch {
      // ignore—anchor link will be present as primary path
    }
  }, [buildTemplateCastText])

  /* ------------- derived ------------- */
  const allCards = useMemo(() => {
    const s = started.map((c) => ({ ...c, group: 'Started' }))
    const j = joined.map((c) => ({ ...c, group: 'Joined' }))
    const w = wins.map((c) => ({ ...c, group: 'Won' }))
    const v = voted.map((c) => ({ ...c, group: 'Voted' }))
    const map = new Map()
    for (const c of [...j, ...w, ...s]) {
      const key = `pool1-${c.id}`
      const prev = map.get(key)
      if (!prev || (prev.group === 'Joined' && c.group === 'Started')) map.set(key, c)
    }
    for (const c of v) map.set(`pool2-${c.id}`, c)
    return Array.from(map.values())
  }, [started, joined, wins, voted])

  const viewCards = useMemo(() => {
    let rs = [...allCards]
    if (filter === 'started') rs = rs.filter((r) => r.kind === 'pool1' && r.group === 'Started')
    else if (filter === 'joined') rs = rs.filter((r) => r.kind === 'pool1' && r.group !== 'Started')
    else if (filter === 'voted') rs = rs.filter((r) => r.kind === 'pool2')
    else if (filter === 'wins') rs = rs.filter((r) => r.kind === 'pool1' && r.youWon)
    else if (filter === 'unclaimed') rs = rs.filter((r) => r.kind === 'pool1' && r.youWon && !r.claimed)
    if (sortBy === 'oldest') rs.sort((a, b) => a.id - b.id)
    else if (sortBy === 'prize') rs.sort((a, b) => (b.poolUsd || 0) - (a.poolUsd || 0))
    else rs.sort((a, b) => b.id - a.id)
    return rs
  }, [allCards, filter, sortBy])

  const stats = useMemo(() => {
    const created = started.length
    const totalJoined = joined.length
    const winCount = wins.length
    const unclaimedCount = unclaimedWins.length
    const totalFeesEth = joined.reduce((s, r) => s + (r.feeEth || 0), 0)
    const totalFeesUsd = joined.reduce((s, r) => s + (r.feeUsd || 0), 0)
    const totalPoolUsd = joined.reduce((s, r) => s + (r.poolUsd || 0), 0)
    return { created, totalJoined, winCount, unclaimedCount, totalFeesEth, totalFeesUsd, totalPoolUsd }
  }, [started, joined, wins, unclaimedWins])

  /* ------------- SEO / Frames ------------- */
  const pageUrl = absoluteUrl('/myrounds')
  const ogImage = buildOgUrl({ screen: 'myrounds', user: shortAddr(address) || 'anon' })

  return (
    <Layout>
      <Head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="My Rounds" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <SEO
        title="My Rounds — MadFill"
        description="See rounds you created, joined, voted in, and any wins. Claim unclaimed payouts and view your MadFill NFTs."
        url={pageUrl}
        image={ogImage}
        type="profile"
        twitterCard="summary_large_image"
      />

      {showConfetti && width > 0 && height > 0 && <Confetti width={width} height={height} />}

      <main className="w-full mx-auto max-w-6xl px-4 sm:px-6 md:px-8 py-4 md:py-6 text-white space-y-6 overflow-x-hidden">
        {/* Header */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-3xl md:text-4xl font-extrabold leading-tight bg-gradient-to-r from-amber-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent break-words">
                🗂️ My Rounds
              </h1>
              <p className="text-slate-300 mt-1 break-words">
                {isConnected ? (
                  <>Signed in as <span className="font-mono">{shortAddr(address)}</span></>
                ) : (
                  <>Connect your wallet to see your rounds and NFTs.</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isConnected ? (
                <Button onClick={connect} className="bg-amber-500 hover:bg-amber-400 text-black">Connect Wallet</Button>
              ) : !isOnBase ? (
                <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600">Switch to Base</Button>
              ) : (
                <Button
                  variant="outline"
                  className="border-slate-600 text-slate-200"
                  onClick={loadMyRounds}
                  disabled={!address || loading}
                  title="Reload"
                >
                  {loading ? 'Loading…' : '↻ Refresh'}
                </Button>
              )}
            </div>
          </div>

          {status && (
            <div className="mt-3 rounded bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-amber-200">
              {status}
            </div>
          )}

          {/* Tabs */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-800/40 p-2">
            {[
              { key: 'stats', label: '📊 Stats' },
              { key: 'nfts', label: '🎨 My NFTs' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`h-11 rounded-xl px-3 text-sm font-semibold transition ${
                  activeTab === t.key
                    ? 'bg-yellow-500 text-black'
                    : 'bg-slate-900/60 border border-slate-700 text-slate-200 hover:bg-slate-900'
                }`}
                aria-pressed={activeTab === t.key}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'stats' && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Created" value={stats.created} />
              <StatCard label="Joined" value={stats.totalJoined} />
              <StatCard label="Wins" value={stats.winCount} />
              <StatCard label="Unclaimed" value={stats.unclaimedCount} />
              <StatCard label="Fees (ETH)" value={fmt(stats.totalFeesEth, 4)} />
              <StatCard label="Fees (USD)" value={`$${fmt(stats.totalFeesUsd)}`} />
              <StatCard label="Total Pool (USD est.)" value={`$${fmt(stats.totalPoolUsd)}`} className="md:col-span-2" />
            </div>
          )}

          {activeTab === 'nfts' && (
            <div className="mt-4">
              {!isConnected ? (
                <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-4 text-sm text-slate-300">
                  Connect your wallet to view NFTs.
                </div>
              ) : nftLoading ? (
                <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-4 text-sm text-slate-300">
                  Loading your NFTs…
                </div>
              ) : nfts.length === 0 ? (
                <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-4 text-sm text-slate-300">
                  No MadFill NFTs found for <span className="font-mono">{shortAddr(address)}</span>.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {nfts.map((t) => {
                    const castText = buildTemplateCastText(t)
                    const castUrl = buildWarpcastUrl({ text: castText })
                    return (
                      <div key={t.id} className="rounded-2xl bg-slate-900/70 border border-slate-700 overflow-hidden shadow-lg">
                        {t.image ? (
                          <div className="aspect-video bg-slate-800 border-b border-slate-700">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={t.image} alt={t.name || `Token #${t.id}`} className="w-full h-full object-cover" />
                          </div>
                        ) : <div className="aspect-video bg-slate-800 border-b border-slate-700" />}
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-base md:text-lg font-bold truncate text-slate-100">
                              {t.name || `Template #${t.id}`}
                            </div>
                            {t.theme && (
                              <span className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] md:text-xs font-semibold bg-indigo-600/30 text-indigo-200 border border-indigo-500/40">
                                {t.theme}
                              </span>
                            )}
                          </div>

                          {t.desc && (
                            <div className="text-xs md:text-sm text-slate-300 mt-1 line-clamp-2">
                              {t.desc}
                            </div>
                          )}

                          {/* Polished reconstructed template */}
                          {Array.isArray(t.parts) && t.parts.length > 0 && (
                            <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-indigo-900/50 to-slate-900/70 border border-indigo-700/40 text-slate-100 text-base md:text-lg leading-7 font-medium tracking-wide shadow-inner whitespace-pre-wrap break-words">
                              {renderTemplateParts(t.parts, blankToken)}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 mt-3">
                            {/* BaseScan */}
                            <a
                              href={`https://basescan.org/token/${NFT_ADDRESS}?a=${t.id}`}
                              target="_blank" rel="noopener noreferrer"
                              className="px-3 py-2 rounded-md bg-slate-800 border border-slate-600 hover:bg-slate-700 text-xs"
                            >
                              BaseScan
                            </a>

                            {/* Primary: open Warpcast composer in a new tab. */}
                            <Button asChild className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs">
                              <a
                                href={castUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => tryOpenCast(t)} // JS fallback (does nothing harmful if link opens)
                              >
                                Cast this template
                              </a>
                            </Button>
                          </div>

                          <div className="text-[11px] text-slate-400 mt-2 break-all">
                            {t.tokenURI
                              ? <a className="underline" href={ipfsToHttp(t.tokenURI)} target="_blank" rel="noreferrer">tokenURI</a>
                              : 'No tokenURI'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              ['all', 'All'],
              ['started', 'Started'],
              ['joined', 'Joined'],
              ['wins', 'Wins'],
              ['unclaimed', 'Unclaimed'],
              ['voted', 'Voted'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded text-sm ${
                  filter === key
                    ? 'bg-yellow-500 text-black'
                    : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
                aria-pressed={filter === key}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="text-sm text-slate-300">
            Sort by{' '}
            <select
              className="ml-1 bg-slate-900 border border-slate-700 rounded px-2 py-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort cards"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="prize">Prize (USD)</option>
            </select>
          </label>
        </div>

        {/* Cards */}
        {!isConnected ? (
          <div className="text-center text-slate-300 py-16">
            Connect your wallet (top-right) to view your rounds.&nbsp;
            <Link href="/" className="underline text-indigo-300">Create a new round</Link>.
          </div>
        ) : loading ? (
          <div className="text-center text-slate-400 py-16">Loading your rounds…</div>
        ) : viewCards.length === 0 ? (
          <div className="text-center text-slate-300 py-16">
            No rounds found for this filter. Try another filter or{' '}
            <Link href="/" className="underline text-indigo-300">start a new round</Link>.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {viewCards.map((card) => {
              const isPool1 = card.kind === 'pool1'
              const roundUrl = absoluteUrl(`/round/${isPool1 ? card.id : card.originalPool1Id}`)
              const shareTxt = isPool1
                ? `Check out my MadFill Round #${card.id}! ${roundUrl}`
                : `I voted on a MadFill challenger for Round #${card.originalPool1Id}! ${roundUrl}`
              const endsLabel = formatTimeLeft(card.deadline)

              return (
                <Card key={`${card.kind}-${card.id}`} className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl hover:shadow-xl transition-all duration-300 min-w-0 overflow-hidden">
                  <CardHeader className="flex justify-between items-start gap-3 min-w-0">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="text-2xl shrink-0">{isPool1 ? '🧩' : '⚔️'}</div>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold truncate">
                          {isPool1 ? <>#{card.id} — {card.name}</> : <>Vote #{card.id} — Round #{card.originalPool1Id}</>}
                        </h2>
                        <div className="mt-1">{statusBadge(card)}</div>
                        {isPool1 && card.theme && <p className="text-xs text-slate-400 mt-1 break-words">Theme: {card.theme}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <div className="text-xs text-slate-300">{endsLabel === 'Ended' ? 'Ended' : <>Ends in {endsLabel}</>}</div>
                      <div className="mt-1">
                        <Countdown targetTimestamp={card.deadline} />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 text-sm min-w-0">
                    <div className="p-3 rounded bg-slate-800/60 border border-slate-700 leading-relaxed break-words">
                      {isPool1 ? card.preview : card.chPreview}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      {isPool1 ? (
                        <>
                          <div className="min-w-0"><span className="text-slate-400">Entry Fee:</span> {fmt(card.feeEth, 4)} ETH (${fmt(card.feeUsd)})</div>
                          <div className="min-w-0"><span className="text-slate-400">Pool:</span> {fmt(card.poolEth, 4)} ETH (${fmt(card.poolUsd)})</div>
                          <div className="min-w-0"><span className="text-slate-400">Participants:</span> {card.participantsCount}</div>
                          <div className="min-w-0"><span className="text-slate-400">Creator:</span> <span className="font-mono">{shortAddr(card.creator)}</span></div>
                        </>
                      ) : (
                        <>
                          <div className="min-w-0"><span className="text-slate-400">Votes (OG):</span> {card.votersOriginal}</div>
                          <div className="min-w-0"><span className="text-slate-400">Votes (Ch):</span> {card.votersChallenger}</div>
                          <div className="min-w-0"><span className="text-slate-400">Fee / vote:</span> {fmt(card.feeBase, 4)} ETH</div>
                          <div className="min-w-0"><span className="text-slate-400">Pool:</span> {fmt(card.poolEth, 4)} ETH (${fmt(card.poolUsd)})</div>
                        </>
                      )}
                    </div>

                    {/* ShareBar for rounds */}
                    <ShareBar
                      url={roundUrl}
                      text={shareTxt}
                      og={{ screen: 'round', roundId: String(isPool1 ? card.id : card.originalPool1Id) }}
                      small
                    />

                    <div className="flex gap-2 pt-1">
                      {isPool1 ? (
                        <>
                          <Link href={`/round/${card.id}`} className="w-full">
                            <Button className="w-full bg-indigo-600 hover:bg-indigo-500">View Round</Button>
                          </Link>
                          {card.ended && card.youWon && !card.claimed && (
                            <Button
                              onClick={() => finalizePool1(card.id)}
                              className="w-full bg-emerald-600 hover:bg-emerald-500"
                              title="Claim winnings"
                            >
                              Claim
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Link href={`/vote`} className="w-full">
                            <Button className="w-full bg-fuchsia-600 hover:bg-fuchsia-500">Go to Vote</Button>
                          </Link>
                          <Link href={`/round/${card.originalPool1Id}`} className="w-full">
                            <Button variant="outline" className="w-full border-slate-600 text-slate-200">View Round</Button>
                          </Link>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-10 text-xs text-slate-400 flex flex-wrap items-center gap-3 justify-between border-t border-slate-800 pt-4">
          <div className="flex items-center gap-3">
            <Link href="/challenge" className="underline text-indigo-300">Start a Challenge</Link>
            {FILLIN_ADDRESS && (
              <a
                href={`https://basescan.org/address/${FILLIN_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="underline text-indigo-300"
                title="View FillIn contract on BaseScan"
              >
                FillIn Contract
              </a>
            )}
            {NFT_ADDRESS && (
              <a
                href={`https://basescan.org/token/${NFT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="underline text-indigo-300"
                title="View NFT contract on BaseScan"
              >
                NFT Contract
              </a>
            )}
          </div>
          <div className="opacity-80">Built on Base • MadFill</div>
        </footer>

        <div className="text-[11px] text-slate-500 text-center mt-2">
          Prices use public ETH/USD spot (approx). Cached results shown if RPC is flaky; use Refresh for a fresh pull.
        </div>
      </main>
    </Layout>
  )
}

export default dynamic(() => Promise.resolve(MyRoundsPage), { ssr: false })
