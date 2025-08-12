// pages/vote.jsx
'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'
import Layout from '@/components/Layout' // ✅ wrap each page (since _app doesn't)
import SEO from '@/components/SEO'
import ShareBar from '@/components/ShareBar'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryV3_ABI.json'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import dynamic from 'next/dynamic'

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

// ---- Config ----
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID = 8453n
const BASE_CHAIN_ID_HEX = '0x2105' // Base

// IMPORTANT: V3 does not expose Pool2 vote fee in views. Use env.
// Fallback: 0.0005 ETH
const DEFAULT_VOTE_FEE_WEI = ethers.parseUnits('0.0005', 18)
const VOTE_FEE_WEI =
  (process.env.NEXT_PUBLIC_POOL2_VOTE_FEE_WEI && BigInt(process.env.NEXT_PUBLIC_POOL2_VOTE_FEE_WEI)) ||
  DEFAULT_VOTE_FEE_WEI

export default function VotePage() {
  useMiniAppReady()

  // state
  const [rounds, setRounds] = useState([]) // Pool2 cards
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [address, setAddress] = useState(null)
  const [isOnBase, setIsOnBase] = useState(true)
  const [success, setSuccess] = useState(false)
  const [claimedId, setClaimedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [priceUsd, setPriceUsd] = useState(3800)

  const { width, height } = useWindowSize()
  const tickRef = useRef(null)

  // Prefer Warpcast Mini wallet; fallback to injected
  const miniProvRef = useRef(null)
  const getEip1193 = useCallback(async () => {
    if (typeof window !== 'undefined' && window.ethereum) return window.ethereum
    if (miniProvRef.current) return miniProvRef.current
    const inWarpcast = typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)
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

  // ---- utils ----
  const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
  const toEth = (wei) => (wei ? Number(ethers.formatEther(wei)) : 0)
  const fmt = (n, d = 2) => new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n)
  const explorer = (path) => `https://basescan.org/${path}`

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
  const needsSpaceBefore = (str) => {
    if (!str) return false
    const ch = str[0]
    return !(/\s/.test(ch) || /[.,!?;:)"'\]]/.test(ch))
  }
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

  // ---- wallet / chain (observe only) ----
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accts = await window.ethereum.request({ method: 'eth_accounts' })
          if (!cancelled) setAddress(accts?.[0] || null)
        } catch {}
        try {
          const provider = new ethers.BrowserProvider(window.ethereum)
          const net = await provider.getNetwork()
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
      // Warpcast Mini fallback
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

  async function switchToBase() {
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
        } catch (err) {
          console.error(err)
        }
      }
    }
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

  // ---- load Pool2 list + previews ----
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider(BASE_RPC)
        const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)

        const p2Count = Number(await ct.pool2Count())
        const cards = []
        for (let id = 1; id <= p2Count; id++) {
          const info = await ct.getPool2Info(BigInt(id))
          const originalPool1Id = Number(info.originalPool1Id ?? info[0])
          const challengerWordRaw = info.challengerWord ?? info[1]
          const challengerUsername = info.challengerUsername ?? info[2]
          const challengerAddr = info.challenger ?? info[3]
          const votersOriginal = Number(info.votersOriginal ?? info[4])
          const votersChallenger = Number(info.votersChallenger ?? info[5])
          const claimed = Boolean(info.claimed ?? info[6])
          const challengerWon = Boolean(info.challengerWon ?? info[7])
          const poolBalance = info.poolBalance ?? info[8]

          const p1 = await ct.getPool1Info(BigInt(originalPool1Id))
          const parts = p1.parts_ || p1[2]
          const creatorAddr = p1.creator_ || p1[5]
          const p1CreatorSub = await ct.getPool1Submission(BigInt(originalPool1Id), creatorAddr)
          const originalWordRaw = p1CreatorSub[1]

          const originalPreview = buildPreviewFromStored(parts, originalWordRaw)
          const challengerPreview = buildPreviewFromStored(parts, challengerWordRaw)

          const poolEth = toEth(poolBalance)
          const poolUsd = poolEth * priceUsd

          cards.push({
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
          })
        }

        if (cancelled) return
        setRounds(cards)
      } catch (e) {
        console.error('Error loading vote rounds', e)
        if (!cancelled) setRounds([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [priceUsd])

  // ---- actions ----
  async function votePool2(id, voteChallenger) {
    try {
      const eip = await getEip1193()
      if (!eip) throw new Error('Wallet not found')
      setStatus('Submitting vote…')

      await eip.request?.({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(eip)
      const net = await provider.getNetwork()
      if (net?.chainId !== BASE_CHAIN_ID) await switchToBase()
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)

      // ✅ send configured fee with tiny buffer to avoid rounding reverts
      const value = (VOTE_FEE_WEI * 1005n) / 1000n

      // V3: votePool2(uint256 id, bool voteChallenger) payable
      const tx = await ct.votePool2(BigInt(id), Boolean(voteChallenger), { value })
      await tx.wait()
      setStatus('✅ Vote recorded!')
      setSuccess(true) // ✅ confetti
      await reloadCard(id)
      setTimeout(() => setSuccess(false), 1500)
    } catch (e) {
      console.error(e)
      setStatus('❌ ' + (e?.shortMessage || e?.message || 'Vote failed'))
      setSuccess(false)
    }
  }

  async function reloadCard(id) {
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC)
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)

      const info = await ct.getPool2Info(BigInt(id))
      const originalPool1Id = Number(info.originalPool1Id ?? info[0])
      const challengerWordRaw = info.challengerWord ?? info[1]
      const challengerUsername = info.challengerUsername ?? info[2]
      const challengerAddr = info.challenger ?? info[3]
      const votersOriginal = Number(info.votersOriginal ?? info[4])
      const votersChallenger = Number(info.votersChallenger ?? info[5])
      const claimed = Boolean(info.claimed ?? info[6])
      const challengerWon = Boolean(info.challengerWon ?? info[7])
      const poolBalance = info.poolBalance ?? info[8]

      const p1 = await ct.getPool1Info(BigInt(originalPool1Id))
      const parts = p1.parts_ || p1[2]
      const creatorAddr = p1.creator_ || p1[5]
      const p1CreatorSub = await ct.getPool1Submission(BigInt(originalPool1Id), creatorAddr)
      const originalWordRaw = p1CreatorSub[1]

      const poolEth = toEth(poolBalance)
      const poolUsd = poolEth * priceUsd

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
              }
            : r
        )
      )
    } catch {
      // ignore
    }
  }

  async function claimPool2(id) {
    try {
      const eip = await getEip1193()
      if (!eip) throw new Error('Wallet not found')
      setStatus('Claiming…')

      await eip.request?.({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(eip)
      const net = await provider.getNetwork()
      if (net?.chainId !== BASE_CHAIN_ID) await switchToBase()
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)

      const tx = await ct.claimPool2(BigInt(id))
      await tx.wait()
      setClaimedId(id)
      setStatus('✅ Claimed!')
      await reloadCard(id)
      setTimeout(() => setClaimedId(null), 1500)
    } catch (err) {
      console.error('Claim failed:', err)
      setStatus('❌ ' + (err?.shortMessage || err?.message || 'Error claiming prize'))
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
    if (sortBy === 'votes') return arr.sort((a, b) => (b.votersOriginal + b.votersChallenger) - (a.votersOriginal + a.votersChallenger))
    if (sortBy === 'prize') return arr.sort((a, b) => b.poolUsd - a.poolUsd)
    return arr.sort((a, b) => b.id - a.id) // recent
  }, [filtered, sortBy])

  // ---- SEO (SSR-safe) ----
  const pageUrl = absoluteUrl('/vote')
  const ogTitle = 'Community Vote — MadFill'
  const ogDesc = 'Pick the punchline. Vote Original vs Challenger and split the pool with the winners on Base.'
  const ogImage = buildOgUrl({ screen: 'vote', title: 'Community Vote' })

  function StatusPill({ claimed, challengerWon }) {
    if (!claimed) return <span className="px-2 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs">Voting</span>
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

      <main className="max-w-6xl mx-auto p-4 md:p-6 text-white">
        {/* Hero */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-6 md:p-8 mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-amber-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent">
            🗳️ Community Vote
          </h1>
          <p className="mt-2 text-slate-300 max-w-3xl">
            Pick the punchline! Each challenge pits the <span className="font-semibold">Original</span> card (from the round creator)
            against a <span className="font-semibold">Challenger</span> card. Pay a tiny fee to vote; when voting ends, the winning side
            <span className="font-semibold"> splits the prize pool</span>. Feeling spicy?{' '}
            <Link href="/challenge" className="underline text-purple-300">Submit a Challenger</Link>.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Note: V3 doesn&apos;t expose vote deadlines on-chain—cards show as “Voting” until someone finalizes. You can always try to claim:
            if it&apos;s not time yet, the transaction will revert.
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
            >
              <option value="recent">Newest</option>
              <option value="votes">Top Votes</option>
              <option value="prize">Largest Pool</option>
            </select>
          </div>
          {!isOnBase && (
            <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600 text-sm">
              Switch to Base
            </Button>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="rounded-xl bg-slate-900/70 p-6 animate-pulse text-slate-300 text-center">Loading voting rounds…</div>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl bg-slate-900/70 p-6 text-slate-300 text-center">No voting rounds right now.</div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sorted.map((r) => {
              const shareUrl = absoluteUrl(`/round/${r.originalPool1Id}`)
              const shareText = `Vote on MadFill Challenge #${r.id} → Round #${r.originalPool1Id}!`
              return (
                <Card key={r.id} className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
                  <CardHeader className="flex items-start justify-between gap-2 bg-slate-800/60 border-b border-slate-700">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs"><StatusPill claimed={r.claimed} challengerWon={r.challengerWon} /></span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700">
                          Challenge #{r.id}
                        </span>
                        <Link href={`/round/${r.originalPool1Id}`} className="text-indigo-300 underline text-xs">
                          View Round #{r.originalPool1Id}
                        </Link>
                      </div>
                      <div className="text-lg font-bold">Original vs Challenger</div>
                    </div>
                    <a
                      className="text-indigo-300 underline text-sm"
                      href={explorer(`address/${CONTRACT_ADDRESS}`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Contract
                    </a>
                  </CardHeader>

                  <CardContent className="p-5 space-y-3">
                    {/* Compare */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                        <div className="text-slate-300 text-sm">😂 Original</div>
                        <div className="mt-1 italic leading-relaxed">{r.originalPreview}</div>
                      </div>
                      <div id={`ch-${r.id}`} className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                        <div className="text-slate-300 text-sm">
                          😆 Challenger {r.challengerUsername ? <span className="text-slate-400">by @{r.challengerUsername}</span> : null}
                        </div>
                        <div className="mt-1 italic leading-relaxed">{r.challengerPreview}</div>
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
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      {!r.claimed ? (
                        <>
                          {/* true = voteChallenger */}
                          <Button onClick={() => votePool2(r.id, true)} className="bg-blue-600 hover:bg-blue-500">
                            Vote Challenger
                          </Button>
                          <Button onClick={() => votePool2(r.id, false)} className="bg-green-600 hover:bg-green-500">
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
                          <Button onClick={() => claimPool2(r.id)} className="bg-indigo-600 hover:bg-indigo-500">
                            Claim (if you were on the winning side)
                          </Button>
                        </>
                      )}

                      {/* Social */}
                      <ShareBar
                        url={shareUrl}
                        text={shareText}
                        small
                        className="ml-auto"
                        og={{ screen: 'round', roundId: String(r.originalPool1Id) }}
                      />
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Voting fee comes from the challenge. App sends {fmt(toEth(VOTE_FEE_WEI), 6)} ETH (+ tiny buffer).
                      To override, set <code className="mx-1 bg-slate-800 px-1 rounded">NEXT_PUBLIC_POOL2_VOTE_FEE_WEI</code>.
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {status && <div className="mt-6 text-center text-yellow-300">{status}</div>}
      </main>
    </Layout>
  )
}
