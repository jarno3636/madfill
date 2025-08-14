// pages/myrounds.jsx
'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useWindowSize } from 'react-use'
import { ethers } from 'ethers'

import Layout from '@/components/Layout'
import SEO from '@/components/SEO'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ShareBar from '@/components/ShareBar'
import { fetchFarcasterProfile } from '@/lib/neynar'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import abi from '@/abi/FillInStoryV3_ABI.json'

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

/** ---------------- env / chain ---------------- */
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // V3 fallback

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID = 8453n
const BASE_CHAIN_ID_HEX = '0x2105' // 8453

/** ---------------- small helpers ---------------- */
const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
const toEth = (wei) => (wei ? Number(ethers.formatEther(wei)) : 0)
const fmt = (n, d = 2) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n)

const needsSpaceBefore = (str) => {
  if (!str) return false
  const ch = str[0]
  return !(/\s/.test(ch) || /[.,!?;:)"'\]]/.test(ch))
}

function buildPreviewSingle(parts, word, blankIndex) {
  const n = parts?.length || 0
  if (n === 0) return ''
  const blanks = Math.max(0, n - 1)
  const idx = Math.max(0, Math.min(blanks - 1, Number(blankIndex) || 0))
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

function formatTimeLeft(deadlineSec) {
  const now = Math.floor(Date.now() / 1000)
  const diff = Math.max(0, deadlineSec - now)
  if (diff === 0) return 'Ended'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** ---------------- page ---------------- */
export default function MyRounds() {
  useMiniAppReady()

  // wallet-ish state (read-only observe in this page)
  const [address, setAddress] = useState(null)
  const [isOnBase, setIsOnBase] = useState(true)

  // data & ui
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [priceUsd, setPriceUsd] = useState(3800)
  const [profile, setProfile] = useState(null)

  const [started, setStarted] = useState([])
  const [joined, setJoined] = useState([])
  const [wins, setWins] = useState([])
  const [unclaimedWins, setUnclaimedWins] = useState([])
  const [voted, setVoted] = useState([])

  const [filter, setFilter] = useState('all') // all | started | joined | voted | wins | unclaimed
  const [sortBy, setSortBy] = useState('newest') // newest | oldest | prize
  const [activeTab, setActiveTab] = useState('stats') // stats | nfts
  const [showConfetti, setShowConfetti] = useState(false)
  const [contractAddrUsed, setContractAddrUsed] = useState(CONTRACT_ADDRESS)

  const { width, height } = useWindowSize()
  const tickRef = useRef(null)
  const miniProvRef = useRef(null)

  // prefer Mini App provider when on Warpcast
  const getEip1193 = useCallback(async () => {
    if (typeof window !== 'undefined' && window.ethereum) return window.ethereum
    if (miniProvRef.current) return miniProvRef.current
    const inWarpcast =
      typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)
    if (!inWarpcast) return null
    try {
      const mod = await import('@farcaster/miniapp-sdk')
      const prov = await mod.sdk.wallet.getEthereumProvider()
      miniProvRef.current = prov
      return prov
    } catch {
      return null
    }
  }, [])

  // observe wallet passively
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accts = await window.ethereum.request({ method: 'eth_accounts' })
          if (!cancelled) setAddress(accts?.[0] || null)
        } catch {}
        try {
          const p = new ethers.BrowserProvider(window.ethereum)
          const net = await p.getNetwork()
          if (!cancelled) setIsOnBase(net?.chainId === BASE_CHAIN_ID)
        } catch {
          if (!cancelled) setIsOnBase(true)
        }
        const onChain = () => location.reload()
        const onAcct = (accs) => setAddress(accs?.[0] || null)
        window.ethereum.on?.('chainChanged', onChain)
        window.ethereum.on?.('accountsChanged', onAcct)
        return () => {
          window.ethereum.removeListener?.('chainChanged', onChain)
          window.ethereum.removeListener?.('accountsChanged', onAcct)
        }
      }
      const mini = await getEip1193()
      if (mini && !cancelled) {
        try {
          const p = new ethers.BrowserProvider(mini)
          const signer = await p.getSigner().catch(() => null)
          const addr = await signer?.getAddress().catch(() => null)
          if (!cancelled) setAddress(addr || null)
          const net = await p.getNetwork()
          if (!cancelled) setIsOnBase(net?.chainId === BASE_CHAIN_ID)
        } catch {}
      }
    })()
    return () => { cancelled = true }
  }, [getEip1193])

  const switchToBase = useCallback(async () => {
    const eip = await getEip1193()
    if (!eip) return
    try {
      await eip.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      })
      setIsOnBase(true)
    } catch (e) {
      if (e?.code === 4902) {
        try {
          await eip.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: BASE_CHAIN_ID_HEX,
              chainName: 'Base',
              rpcUrls: [BASE_RPC],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: ['https://basescan.org'],
            }],
          })
          setIsOnBase(true)
        } catch {
          setStatus('Could not add/switch to Base.')
        }
      }
    }
  }, [getEip1193])

  // fx: price pull (usd approx)
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
    tickRef.current = setInterval(() => setStatus((s) => s || ''), 1000)
    return () => clearInterval(tickRef.current)
  }, [])

  // fc profile (optional nicety)
  useEffect(() => {
    if (!address) return
    ;(async () => {
      try {
        const p = await fetchFarcasterProfile(address)
        setProfile(p || null)
      } catch {}
    })()
  }, [address])

  // load user's rounds
  const loadMyRounds = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setStatus('')
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC)
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
      setContractAddrUsed(CONTRACT_ADDRESS)

      const [ids1, ids2] = await ct.getUserEntries(address)
      const pool1Ids = ids1.map(Number)
      const voteIds = ids2.map(Number)

      const joinedCards = await Promise.all(
        pool1Ids.map(async (id) => {
          const info = await ct.getPool1Info(BigInt(id))
          const parts = info[2]
          const feeBase = info[3]
          const poolBalance = info[9]
          const yourSub = await ct.getPool1Submission(BigInt(id), address)
          const preview = buildPreviewSingle(parts, yourSub[1], Number(yourSub[3] ?? 0))
          const feeEth = toEth(feeBase)
          const poolEth = toEth(poolBalance)

          return {
            kind: 'pool1',
            id,
            name: info[0] || `Round #${id}`,
            theme: info[1],
            parts,
            preview,
            word: yourSub[1],
            username: yourSub[0],
            blankIndex: Number(yourSub[3] ?? 0),
            feeEth,
            feeUsd: feeEth * priceUsd,
            poolEth,
            poolUsd: poolEth * priceUsd,
            deadline: Number(info[4]),
            creator: info[5],
            participantsCount: info[6]?.length || 0,
            winner: info[7],
            claimed: Boolean(info[8]),
            ended: Math.floor(Date.now() / 1000) >= Number(info[4]),
            youWon: info[7] && info[7].toLowerCase() === address.toLowerCase(),
            isCreator: info[5] && info[5].toLowerCase() === address.toLowerCase(),
          }
        })
      )

      const startedCards = joinedCards.filter((c) => c.isCreator)
      const winCards = joinedCards.filter((c) => c.youWon)
      const unclaimed = winCards.filter((c) => !c.claimed)

      const votedCards = await Promise.all(
        voteIds.map(async (id) => {
          const p2 = await ct.getPool2InfoFull(BigInt(id))
          const info = await ct.getPool1Info(BigInt(Number(p2[0])))
          const creatorSub = await ct.getPool1Submission(BigInt(Number(p2[0])), info[5])
          return {
            kind: 'pool2',
            id,
            originalPool1Id: Number(p2[0]),
            chUsername: p2[2],
            chWord: p2[1],
            chPreview: buildPreviewSingle(info[2], p2[1], Number(creatorSub[3] ?? 0)),
            challenger: p2[3],
            votersOriginal: Number(p2[4]),
            votersChallenger: Number(p2[5]),
            claimed: Boolean(p2[6]),
            challengerWon: Boolean(p2[7]),
            poolEth: toEth(p2[8]),
            poolUsd: toEth(p2[8]) * priceUsd,
            feeBase: toEth(p2[9]),
            deadline: Number(p2[10]),
          }
        })
      )

      setJoined(joinedCards)
      setStarted(startedCards)
      setWins(winCards)
      setUnclaimedWins(unclaimed)
      setVoted(votedCards)
    } catch (err) {
      console.error('Error loading My Rounds:', err)
      setStatus('Failed to load your rounds.')
      setJoined([]); setStarted([]); setWins([]); setUnclaimedWins([]); setVoted([])
    } finally {
      setLoading(false)
    }
  }, [address, priceUsd])

  useEffect(() => { if (address) loadMyRounds() }, [address, priceUsd, loadMyRounds])

  // claim / finalize
  async function finalizePool1(id) {
    try {
      const eip = await getEip1193()
      if (!eip) throw new Error('Wallet not found')
      setStatus('Finalizing round…')

      await eip.request?.({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(eip)
      if ((await provider.getNetwork()).chainId !== BASE_CHAIN_ID) await switchToBase()

      const signer = await provider.getSigner()
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)
      const tx = await ct.claimPool1(BigInt(id))
      await tx.wait()
      setStatus('Finalized')
      setShowConfetti(true)
      setJoined((rs) => rs.map((r) => (r.id === id ? { ...r, claimed: true } : r)))
      setWins((rs) => rs.map((r) => (r.id === id ? { ...r, claimed: true } : r)))
      setUnclaimedWins((rs) => rs.filter((r) => r.id !== id))
      setTimeout(() => setShowConfetti(false), 2000)
    } catch (e) {
      console.error(e)
      setStatus(String(e?.shortMessage || e?.reason || e?.message || 'Finalize failed'))
      setShowConfetti(false)
    }
  }

  // dedupe + derived views
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

  // quick stats (client only derived)
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

  // SEO / Frames
  const pageUrl = absoluteUrl('/myrounds')
  const ogTitle = profile?.username
    ? `@${profile.username} on MadFill — My Rounds`
    : 'My Rounds — MadFill'
  const ogDesc = 'See rounds you created, joined, voted in, and any wins.'
  const ogImage = buildOgUrl({
    screen: 'myrounds',
    user: profile?.username || shortAddr(address) || 'anon',
  })

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
        title={ogTitle}
        description={ogDesc}
        url={pageUrl}
        image={ogImage}
        type="profile"
        twitterCard="summary_large_image"
      />

      {showConfetti && <Confetti width={width} height={height} />}

      <main className="max-w-6xl mx-auto p-4 md:p-6 text-white space-y-6">
        {/* Header */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">🗂️ My Rounds</h1>
              <p className="text-slate-300">
                {address ? (
                  <>Signed in as <span className="font-mono">{shortAddr(address)}</span>{profile?.username ? ` (@${profile.username})` : ''}</>
                ) : (
                  <>Connect your wallet to see rounds you created, joined, or voted.</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isOnBase && (
                <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600">
                  Switch to Base
                </Button>
              )}
              <Button
                variant="outline"
                className="border-slate-600 text-slate-200"
                onClick={loadMyRounds}
                disabled={!address || loading}
                title={address ? 'Reload' : 'Connect wallet to load'}
              >
                {loading ? 'Loading…' : '↻ Refresh'}
              </Button>
            </div>
          </div>

          {status && (
            <div className="mt-3 rounded bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-amber-200">
              {status}
            </div>
          )}

          {/* Primary page tabs (Stats / NFTs) */}
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
            <div className="mt-4 rounded-xl bg-slate-900/60 border border-slate-700 p-4 text-sm text-slate-300">
              <p className="mb-2">Your minted MadFill NFTs will appear here.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>We’ll read tokens owned by <span className="font-mono">{shortAddr(address) || 'your wallet'}</span> on Base.</li>
                <li>Preview thumbnails and quick links to view on BaseScan / marketplaces.</li>
              </ul>
              {/* TODO(nfts): Implement owned-NFTs query for the MadFill contract (TheGraph/Alchemy/Reservoir). */}
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
        {!address ? (
          <div className="text-center text-slate-300 py-16">
            Connect your wallet (top-right) to view your rounds.{' '}
            <Link href="/" className="underline text-indigo-300">
              Create a new round
            </Link>
            .
          </div>
        ) : loading ? (
          <div className="text-center text-slate-400 py-16">Loading your rounds…</div>
        ) : viewCards.length === 0 ? (
          <div className="text-center text-slate-300 py-16">
            No rounds found for this filter. Try another filter or{' '}
            <Link href="/" className="underline text-indigo-300">
              start a new round
            </Link>
            .
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
                <Card
                  key={`${card.kind}-${card.id}`}
                  className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl hover:shadow-xl transition-all duration-300"
                >
                  <CardHeader className="flex justify-between items-start gap-3">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{isPool1 ? '🧩' : '⚔️'}</div>
                      <div>
                        <h2 className="text-lg font-bold">
                          {isPool1 ? (
                            <>#{card.id} — {card.name}</>
                          ) : (
                            <>Vote #{card.id} — Round #{card.originalPool1Id}</>
                          )}
                        </h2>
                        <div className="mt-1">{statusBadge(card)}</div>
                        {isPool1 && card.theme && (
                          <p className="text-xs text-slate-400 mt-1">Theme: {card.theme}</p>
                        )}
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

                    {/* Share */}
                    <ShareBar url={roundUrl} text={shareTxt} og={{ screen: 'round', roundId: String(isPool1 ? card.id : card.originalPool1Id) }} small />

                    {/* Actions */}
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

        {/* Footer note */}
        <div className="text-xs text-slate-400 text-center">
          Contract: <span className="font-mono">{contractAddrUsed}</span> • Prices use a public ETH/USD spot (approx).
        </div>
      </main>
    </Layout>
  )
}

/** ---------------- small UI bits ---------------- */
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
  // pool1
  if (card.claimed) return <span className="inline-block px-2 py-0.5 rounded bg-emerald-700/40 text-emerald-200 text-xs">Claimed</span>
  if (card.ended) {
    return card.youWon
      ? <span className="inline-block px-2 py-0.5 rounded bg-yellow-600/40 text-yellow-200 text-xs">You won</span>
      : <span className="inline-block px-2 py-0.5 rounded bg-slate-700/40 text-slate-200 text-xs">Ended</span>
  }
  return <span className="inline-block px-2 py-0.5 rounded bg-cyan-700/40 text-cyan-200 text-xs">Active</span>
}
