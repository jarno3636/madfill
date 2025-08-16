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
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import { useTx } from '@/components/TxProvider'
import fillAbi from '@/abi/FillInStoryV3_ABI.json'

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

/** ---------- small helpers ---------- */
const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
const toEth = (wei) => {
  try { return Number(ethers.formatEther(wei ?? 0n)) } catch { return 0 }
}
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
const formatTimeLeft = (deadlineSec) => {
  const now = Math.floor(Date.now() / 1000)
  const diff = Math.max(0, Number(deadlineSec || 0) - now)
  if (diff === 0) return 'Ended'
  const d = Math.floor(diff / 86400), h = Math.floor((diff % 86400) / 3600), m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** ---------- minimal NFT ABI (read) ---------- */
const NFT_READ_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)'
]

/** ---------- UI bits ---------- */
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

/** ---------- page ---------- */
function MyRoundsPage() {
  useMiniAppReady()
  const { width, height } = useWindowSize()

  // ✅ unified wallet/tx context
  const {
    address, isConnected, isOnBase, connect, switchToBase,
    getContracts, claimPool1,
    BASE_RPC, FILLIN_ADDRESS, NFT_ADDRESS,
  } = useTx()

  // ui/data
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

  // filters
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [activeTab, setActiveTab] = useState('stats')

  // price (display only)
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const j = await r.json()
        if (!dead) setPriceUsd(Number(j?.ethereum?.usd || 0))
      } catch { if (!dead) setPriceUsd(0) }
    })()
    return () => { dead = true }
  }, [])

  // load rounds for user
  const loadMyRounds = useCallback(async () => {
    if (!address) return
    setLoading(true); setStatus('')
    try {
      const readProv = new ethers.JsonRpcProvider(BASE_RPC)
      const ct = new ethers.Contract(FILLIN_ADDRESS, fillAbi, readProv)

      const [ids1, ids2] = await ct.getUserEntries(address)
      const pool1Ids = (ids1 || []).map(Number)
      const voteIds = (ids2 || []).map(Number)

      const p1Cards = await Promise.all(pool1Ids.map(async (id) => {
        const info = await ct.getPool1Info(BigInt(id))
        const name = info.name_ ?? info[0]
        const theme = info.theme_ ?? info[1]
        const parts = info.parts_ ?? info[2]
        const feeBase = info.feeBase_ ?? info[3]
        const deadline = Number(info.deadline_ ?? info[4])
        const creator = info.creator_ ?? info[5]
        const participants = info.participants_ ?? info[6]
        const winner = info.winner_ ?? info[7]
        const claimed = Boolean(info.claimed_ ?? info[8])
        const poolBalance = info.poolBalance_ ?? info[9]

        const your = await ct.getPool1Submission(BigInt(id), address).catch(() => null)
        const yourUsername = your?.username ?? your?.[0] ?? ''
        const yourWord = your?.word ?? your?.[1] ?? ''
        const yourBlank = Number(your?.blankIndex ?? your?.[3] ?? 0)

        const ended = Math.floor(Date.now() / 1000) >= deadline
        const youWon = (winner && winner.toLowerCase() === address.toLowerCase())

        return {
          kind: 'pool1',
          id, name, theme, parts,
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
      }))

      const startedCards = p1Cards.filter((c) => c.isCreator)
      const winCards = p1Cards.filter((c) => c.youWon)
      const unclaimed = winCards.filter((c) => !c.claimed)

      const p2Cards = await Promise.all(voteIds.map(async (id) => {
        const p2 = await ct.getPool2InfoFull(BigInt(id))
        const originalId = Number(p2.originalPool1Id ?? p2[0])
        const chWord = p2.challengerWord ?? p2[1]
        const chUsername = p2.challengerUsername ?? p2[2]
        const votersOriginalCount = Number(p2.votersOriginalCount ?? p2[4])
        const votersChallengerCount = Number(p2.votersChallengerCount ?? p2[5])
        const claimed = Boolean(p2.claimed ?? p2[6])
        const challengerWon = Boolean(p2.challengerWon ?? p2[7])
        const poolEth = toEth(p2.poolBalance ?? p2[8])
        const poolUsd = poolEth * priceUsd
        const feeBase = toEth(p2.feeBase ?? p2[9])
        const deadline = Number(p2.deadline ?? p2[10])

        const info = await ct.getPool1Info(BigInt(originalId))
        const parts = info.parts_ ?? info[2]
        const creatorSub = await ct.getPool1Submission(BigInt(originalId), info.creator_ ?? info[5]).catch(() => null)
        const creatorBlank = Number(creatorSub?.blankIndex ?? creatorSub?.[3] ?? 0)

        return {
          kind: 'pool2',
          id,
          originalPool1Id: originalId,
          chUsername, chWord,
          chPreview: buildPreviewSingle(parts, chWord, creatorBlank),
          votersOriginal: votersOriginalCount,
          votersChallenger: votersChallengerCount,
          claimed, challengerWon,
          poolEth, poolUsd, feeBase, deadline,
        }
      }))

      setJoined(p1Cards)
      setStarted(startedCards)
      setWins(winCards)
      setUnclaimedWins(unclaimed)
      setVoted(p2Cards)
    } catch (e) {
      console.error(e)
      setStatus('Failed to load your rounds.')
      setJoined([]); setStarted([]); setWins([]); setUnclaimedWins([]); setVoted([])
    } finally {
      setLoading(false)
    }
  }, [address, BASE_RPC, FILLIN_ADDRESS, priceUsd])

  useEffect(() => { if (address) loadMyRounds() }, [address, loadMyRounds])

  // claim / finalize (uses TxProvider helper)
  const finalizePool1 = useCallback(async (id) => {
    try {
      setStatus('Finalizing round…')
      await claimPool1(id) // does staticCall preflight inside your helper
      setStatus('Finalized')
      setShowConfetti(true)
      setJoined((rs) => rs.map((r) => (r.id === id ? { ...r, claimed: true } : r)))
      setWins((rs) => rs.map((r) => (r.id === id ? { ...r, claimed: true } : r)))
      setUnclaimedWins((rs) => rs.filter((r) => r.id !== id))
      setTimeout(() => setShowConfetti(false), 1800)
    } catch (e) {
      console.error(e)
      const msg = e?.info?.error?.message || e?.shortMessage || e?.reason || e?.message || 'Finalize failed'
      setStatus(msg)
      setShowConfetti(false)
    }
  }, [claimPool1])

  // NFTs owned (contract-local)
  const loadMyNfts = useCallback(async () => {
    if (!address || !NFT_ADDRESS) { setNfts([]); return }
    setNftLoading(true)
    try {
      const readProv = new ethers.JsonRpcProvider(BASE_RPC)
      const nft = new ethers.Contract(NFT_ADDRESS, NFT_READ_ABI, readProv)

      const bal = Number(await nft.balanceOf(address).catch(() => 0n))
      if (!bal) { setNfts([]); return }

      const tokens = []
      // Try enumerable fast path
      let enumerableWorked = true
      for (let i = 0; i < bal; i++) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const tid = await nft.tokenOfOwnerByIndex(address, i)
          tokens.push(Number(tid))
        } catch {
          enumerableWorked = false
          break
        }
      }
      // Fallback brute-force scan (bounded)
      if (!enumerableWorked) {
        const total = Number(await nft.totalSupply().catch(() => 0n))
        const cap = Math.min(total || 0, 500) // safety cap
        for (let tid = 1; tokens.length < bal && tid <= cap; tid++) {
          // eslint-disable-next-line no-await-in-loop
          const who = await nft.ownerOf(tid).catch(() => null)
          if (who && who.toLowerCase() === address.toLowerCase()) tokens.push(tid)
        }
      }

      const withUris = await Promise.all(tokens.map(async (id) => {
        try {
          const uri = await nft.tokenURI(id)
          return { id, tokenURI: uri }
        } catch { return { id, tokenURI: null } }
      }))
      setNfts(withUris)
    } catch (e) {
      console.error(e)
      setNfts([])
    } finally {
      setNftLoading(false)
    }
  }, [address, BASE_RPC, NFT_ADDRESS])

  useEffect(() => { if (address) loadMyNfts() }, [address, loadMyNfts])

  /** ---------- derived views ---------- */
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

  /** ---------- SEO / Frames ---------- */
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

      <main className="max-w-6xl mx-auto p-4 md:p-6 text-white space-y-6">
        {/* Header */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">🗂️ My Rounds</h1>
              <p className="text-slate-300">
                {isConnected ? (
                  <>Signed in as <span className="font-mono">{shortAddr(address)}</span></>
                ) : (
                  <>Connect your wallet to see your rounds and NFTs.</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
                  {nfts.map((t) => (
                    <div key={t.id} className="rounded-xl bg-slate-900/60 border border-slate-700 p-4">
                      <div className="text-sm font-semibold">Token #{t.id}</div>
                      <div className="text-xs text-slate-400 break-all mt-1">
                        {t.tokenURI ? <a className="underline" href={t.tokenURI} target="_blank" rel="noopener noreferrer">tokenURI</a> : 'No tokenURI'}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <a
                          className="text-xs underline text-indigo-300"
                          href={`https://basescan.org/token/${NFT_ADDRESS}?a=${t.id}`}
                          target="_blank" rel="noopener noreferrer"
                        >
                          View on BaseScan
                        </a>
                      </div>
                    </div>
                  ))}
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

        {/* Content */}
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
                ? `Check out my MadFill Round #${card.id}!`
                : `I voted on a MadFill challenger for Round #${card.originalPool1Id}!`
              const endsLabel = formatTimeLeft(card.deadline)

              return (
                <Card key={`${card.kind}-${card.id}`} className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl hover:shadow-xl transition-all duration-300">
                  <CardHeader className="flex justify-between items-start gap-3">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{isPool1 ? '🧩' : '⚔️'}</div>
                      <div>
                        <h2 className="text-lg font-bold">
                          {isPool1 ? <>#{card.id} — {card.name}</> : <>Vote #{card.id} — Round #{card.originalPool1Id}</>}
                        </h2>
                        <div className="mt-1">{statusBadge(card)}</div>
                        {isPool1 && card.theme && <p className="text-xs text-slate-400 mt-1">Theme: {card.theme}</p>}
                      </div>
                    </div>
                    <div className="text-xs text-right text-slate-300">
                      {endsLabel === 'Ended' ? 'Ended' : <>Ends in {endsLabel}</>}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 text-sm">
                    <div className="p-3 rounded bg-slate-800/60 border border-slate-700 leading-relaxed">
                      {isPool1 ? card.preview : card.chPreview}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      {isPool1 ? (
                        <>
                          <div><span className="text-slate-400">Entry Fee:</span> {fmt(card.feeEth, 4)} ETH (${fmt(card.feeUsd)})</div>
                          <div><span className="text-slate-400">Pool:</span> {fmt(card.poolEth, 4)} ETH (${fmt(card.poolUsd)})</div>
                          <div><span className="text-slate-400">Participants:</span> {card.participantsCount}</div>
                          <div><span className="text-slate-400">Creator:</span> <span className="font-mono">{shortAddr(card.creator)}</span></div>
                        </>
                      ) : (
                        <>
                          <div><span className="text-slate-400">Votes (OG):</span> {card.votersOriginal}</div>
                          <div><span className="text-slate-400">Votes (Ch):</span> {card.votersChallenger}</div>
                          <div><span className="text-slate-400">Fee / vote:</span> {fmt(card.feeBase, 4)} ETH</div>
                          <div><span className="text-slate-400">Pool:</span> {fmt(card.poolEth, 4)} ETH (${fmt(card.poolUsd)})</div>
                        </>
                      )}
                    </div>

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

        <div className="text-xs text-slate-400 text-center">
          Contracts: <span className="font-mono">{FILLIN_ADDRESS}</span> (FillIn) • <span className="font-mono">{NFT_ADDRESS}</span> (NFT).
          Prices use a public ETH/USD spot (approx).
        </div>
      </main>
    </Layout>
  )
}

export default dynamic(() => Promise.resolve(MyRoundsPage), { ssr: false })
