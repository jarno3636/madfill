// pages/myrounds.jsx
'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '@/abi/FillInStoryV3_ABI.json'
import Link from 'next/link'
import { fetchFarcasterProfile } from '@/lib/neynar'
import ShareBar from '@/components/ShareBar'
import SEO from '@/components/SEO'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import Head from 'next/head'

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x6975a550130642E5cb67A87BE25c8134542D5a0a'

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID = 8453n
const BASE_CHAIN_ID_HEX = '0x2105' // 8453

export default function MyRounds() {
  useMiniAppReady()

  const [address, setAddress] = useState(null)
  const [isOnBase, setIsOnBase] = useState(true)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [priceUsd, setPriceUsd] = useState(3800)

  const [profile, setProfile] = useState(null)

  // canon lists built from on-chain data for the current wallet
  const [started, setStarted] = useState([])        // rounds you created
  const [joined, setJoined] = useState([])          // rounds you entered (includes started)
  const [wins, setWins] = useState([])              // you won
  const [unclaimedWins, setUnclaimedWins] = useState([]) // wins not yet claimed
  const [voted, setVoted] = useState([])            // pool2 votes you cast

  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [showConfetti, setShowConfetti] = useState(false)
  const [contractAddrUsed, setContractAddrUsed] = useState(CONTRACT_ADDRESS)

  const { width, height } = useWindowSize()
  const tickRef = useRef(null)

  // ---- Farcaster Mini wallet preference (fallback to injected) ----
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

  // utils
  const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
  const toEth = (wei) => (wei ? Number(ethers.formatEther(wei)) : 0)
  const fmt = (n, d = 2) => new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n)
  const explorer = (path) => `https://basescan.org/${path}`

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

  // wallet + chain (observe only; connect handled in the header)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // injected first
      if (window?.ethereum) {
        try {
          const accts = await window.ethereum.request({ method: 'eth_accounts' }) // passive, no prompt
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
      // otherwise try Warpcast Mini provider
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

  // light ticker for UI
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

  // profile username for header flair / Farcaster creator meta
  useEffect(() => {
    if (!address) return
    ;(async () => {
      try {
        const p = await fetchFarcasterProfile(address)
        setProfile(p || null)
      } catch {}
    })()
  }, [address])

  // core loader
  async function loadMyRounds() {
    if (!address) return
    setLoading(true)
    setStatus('')
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC)
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
      setContractAddrUsed(CONTRACT_ADDRESS)

      // getUserEntries returns (pool1Ids, pool2Votes)
      const [ids1, ids2] = await ct.getUserEntries(address)
      const pool1Ids = ids1.map((x) => Number(x))
      const voteIds = ids2.map((x) => Number(x))

      // Build Pool1 cards for "joined" (includes "started")
      const joinedCards = await Promise.all(
        pool1Ids.map(async (id) => {
          const info = await ct.getPool1Info(BigInt(id))
          const name = info[0]
          const theme = info[1]
          const parts = info[2]
          const feeBase = info[3]
          const deadline = Number(info[4])
          const creator = info[5]
          const participants = info[6] || []
          const winner = info[7]
          const claimed = info[8]
          const poolBalance = info[9]

          // V3 getPool1Submission returns (username, word, submitter, blankIndex)
          const yourSub = await ct.getPool1Submission(BigInt(id), address)
          const username = yourSub[0]
          const word = yourSub[1]
          const blankIndex = Number(yourSub[3] ?? 0)
          const preview = buildPreviewSingle(parts, word, blankIndex)

          const ended = Math.floor(Date.now() / 1000) >= deadline
          const youWon = winner && winner.toLowerCase() === address.toLowerCase()
          const isCreator = creator && creator.toLowerCase() === address.toLowerCase()

          const feeEth = toEth(feeBase)
          const poolEth = toEth(poolBalance)
          return {
            kind: 'pool1',
            id,
            name: name || `Round #${id}`,
            theme,
            parts,
            preview,
            word,
            username,
            blankIndex,
            feeEth,
            feeUsd: feeEth * priceUsd,
            poolEth,
            poolUsd: poolEth * priceUsd,
            deadline,
            creator,
            participantsCount: participants.length,
            winner,
            claimed,
            ended,
            youWon,
            isCreator,
          }
        })
      )

      // Derived lists
      const startedCards = joinedCards.filter((c) => c.isCreator)
      const winCards = joinedCards.filter((c) => c.youWon)
      const unclaimed = winCards.filter((c) => !c.claimed)

      // Pool2 votes you cast
      const votedCards = await Promise.all(
        voteIds.map(async (id) => {
          const p2 = await ct.getPool2InfoFull(BigInt(id))
          const originalPool1Id = Number(p2[0])
          const challengerWord = p2[1]
          const challengerUsername = p2[2]
          const challenger = p2[3]
          const votersOriginal = Number(p2[4])
          const votersChallenger = Number(p2[5])
          const claimed = p2[6]
          const challengerWon = p2[7]
          const p2Balance = p2[8]
          const p2FeeBase = p2[9]
          const p2Deadline = Number(p2[10])

          // Fetch original parts + creator's submission to get the BLANK INDEX for previews
          const info = await ct.getPool1Info(BigInt(originalPool1Id))
          const parts = info[2]
          const creator = info[5]
          let creatorBlankIndex = 0
          try {
            const creatorSub = await ct.getPool1Submission(BigInt(originalPool1Id), creator)
            creatorBlankIndex = Number(creatorSub[3] ?? 0)
          } catch {}

          const chPreview = buildPreviewSingle(parts, challengerWord, creatorBlankIndex)
          const p2Eth = toEth(p2Balance)
          const p2Usd = p2Eth * priceUsd

          return {
            kind: 'pool2',
            id,
            originalPool1Id,
            chUsername: challengerUsername,
            chWord: challengerWord,
            chPreview,
            challenger,
            votersOriginal,
            votersChallenger,
            claimed,
            challengerWon,
            poolEth: p2Eth,
            poolUsd: p2Usd,
            feeBase: toEth(p2FeeBase),
            deadline: p2Deadline,
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
  }

  useEffect(() => {
    if (!address) return
    loadMyRounds()
  }, [address, priceUsd])

  // actions
  async function finalizePool1(id) {
    try {
      const eip = await getEip1193()
      if (!eip) throw new Error('Wallet not found')
      setStatus('Finalizing round…')

      await eip.request?.({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(eip)
      const net = await provider.getNetwork()
      if (net?.chainId !== BASE_CHAIN_ID) await switchToBase()

      const signer = await provider.getSigner()
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)
      const tx = await ct.claimPool1(BigInt(id))
      await tx.wait()
      setStatus('Finalized')
      setShowConfetti(true)
      setJoined((rs) => rs.map((r) => (r.id === id ? { ...r, claimed: true } : r)))
      setWins((rs) => rs.map((r) => (r.id === id ? { ...r, claimed: true } : r)))
      setUnclaimedWins((rs) => rs.filter((r) => r.id !== id))
      setTimeout(() => setShowConfetti(false), 1500)
    } catch (e) {
      console.error(e)
      setStatus('Finalize failed')
      setShowConfetti(false)
    }
  }

  // combined view for "All"
  const allCards = useMemo(() => {
    const s = started.map((c) => ({ ...c, group: 'Started' }))
    const j = joined.map((c) => ({ ...c, group: 'Joined' }))
    const w = wins.map((c) => ({ ...c, group: 'Won' }))
    const v = voted.map((c) => ({ ...c, group: 'Voted' }))
    // dedupe by pool1 id; keep "Started" tag over "Joined"
    const map = new Map()
    for (const c of [...j, ...w, ...s]) {
      const key = `pool1-${c.id}`
      const prev = map.get(key)
      if (!prev || (prev.group === 'Joined' && c.group === 'Started')) map.set(key, c)
    }
    // pool2 are distinct keys
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

  function statusBadge(card) {
    if (card.kind === 'pool1') {
      if (!card.ended) return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs">Active</span>
      if (card.claimed) return <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs">Completed</span>
      return <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs">Ended — Pending</span>
    }
    if (!card.claimed) return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs">Voting</span>
    return (
      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs">
        {card.challengerWon ? 'Challenger Won' : 'Original Won'}
      </span>
    )
  }

  // SEO (SSR-safe)
  const pageUrl = absoluteUrl('/myrounds')
  const ogTitle = profile?.username ? `@${profile.username} on MadFill — My Rounds` : 'My Rounds — MadFill'
  const ogDesc = 'See rounds you created, joined, voted in, and any wins. Track and share your MadFill activity on Base.'
  const ogImage = buildOgUrl({ screen: 'myrounds', user: profile?.username || shortAddr(address) || 'anon' })

  return (
    <>
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

      <main className="max-w-6xl mx-auto p-4 md:p-6 text-white">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            My Activity
          </h1>
          <div className="mt-2 text-sm text-slate-300">
            <span className="mr-2">Address:</span>
            {address ? (
              <a className="underline decoration-dotted" href={explorer(`address/${address}`)} target="_blank" rel="noreferrer">
                {shortAddr(address)}
              </a>
            ) : (
              <span>Not connected</span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Contract:{' '}
            <a
              className="underline decoration-dotted"
              href={explorer(`address/${contractAddrUsed}`)}
              target="_blank"
              rel="noreferrer"
            >
              {contractAddrUsed}
            </a>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-300">View</label>
            <select
              className="bg-slate-900/70 border border-slate-700 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="started">Started</option>
              <option value="joined">Joined</option>
              <option value="wins">Wins</option>
              <option value="unclaimed">Unclaimed Wins</option>
              <option value="voted">Voted</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-300">Sort</label>
            <select
              className="bg-slate-900/70 border border-slate-700 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="prize">Prize (USD)</option>
            </select>
          </div>
          {!isOnBase && (
            <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600 text-sm">
              Switch to Base
            </Button>
          )}
          <Button onClick={loadMyRounds} className="bg-slate-700 hover:bg-slate-600 text-sm" type="button">
            Refresh
          </Button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="rounded-xl bg-slate-900/70 p-6 animate-pulse text-slate-300 text-center">Loading your activity…</div>
        ) : viewCards.length === 0 ? (
          <div className="rounded-xl bg-slate-900/70 p-6 text-slate-300 text-center">
            Nothing yet. Join a round, start one, or vote in a challenge to see it here.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {viewCards.map((r) => {
              const targetRoundId = r.kind === 'pool1' ? r.id : r.originalPool1Id
              const shareUrl = absoluteUrl(`/round/${targetRoundId}`)
              const shareText =
                r.kind === 'pool1'
                  ? `I played MadFill Round #${r.id}!`
                  : `I voted in a MadFill challenge #${r.id} → Round #${r.originalPool1Id}!`

              return (
                <Card key={`${r.kind}-${r.id}`} className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
                  <CardHeader className="flex items-start justify-between gap-2 bg-slate-800/60 border-b border-slate-700">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{statusBadge(r)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700">
                          {r.kind === 'pool1' ? (r.group === 'Started' ? 'Started' : 'Joined') : 'Voted'}
                        </span>
                        {r.kind === 'pool1' ? (
                          <Link href={`/round/${r.id}`} className="text-indigo-300 underline text-xs">
                            View Round #{r.id}
                          </Link>
                        ) : (
                          <Link href={`/round/${r.originalPool1Id}`} className="text-indigo-300 underline text-xs">
                            View Round #{r.originalPool1Id}
                          </Link>
                        )}
                      </div>
                      <div className="text-lg font-bold">
                        {r.kind === 'pool1' ? `#${r.id} — ${r.name}` : `Challenge #${r.id} → Round #${r.originalPool1Id}`}
                      </div>
                      {r.kind === 'pool1' && (
                        <div className="text-xs text-slate-300">Theme: {r.theme || 'General'}</div>
                      )}
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
                    {/* Previews */}
                    <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-sm">
                      <div className="text-slate-300">{r.kind === 'pool1' ? 'Your Card Preview' : 'Challenger Preview'}</div>
                      <div className="mt-1 italic text-[15px] leading-relaxed">
                        {r.kind === 'pool1' ? r.preview : r.chPreview}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {r.kind === 'pool1' ? (
                        <>
                          <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                            Prize Pool: {fmt(r.poolEth, 6)} ETH (~${fmt(r.poolUsd)})
                          </span>
                          <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                            Entrants: {r.participantsCount}
                          </span>
                          <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                            Ends: {new Date(r.deadline * 1000).toLocaleString()}
                          </span>
                          {r.youWon && (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                              You Won
                            </span>
                          )}
                          {r.group === 'Started' && (
                            <span className="px-2 py-1 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-300">
                              Creator
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                            Pool: {fmt(r.poolEth, 6)} ETH (~${fmt(r.poolUsd)})
                          </span>
                          <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                            Votes — Orig: {r.votersOriginal} • Chall: {r.votersChallenger}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      {r.kind === 'pool1' && r.ended && !r.claimed && (
                        <Button onClick={() => finalizePool1(r.id)} className="bg-indigo-600 hover:bg-indigo-500">
                          Finalize & Payout
                        </Button>
                      )}
                      {r.kind === 'pool1' && r.youWon && r.claimed && (
                        <span className="text-sm font-semibold text-emerald-300">Prize Claimed</span>
                      )}

                      <ShareBar
                        url={shareUrl}
                        text={shareText}
                        small
                        className="ml-auto"
                        og={{ screen: 'round', roundId: String(targetRoundId) }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {status && <div className="mt-6 text-center text-yellow-300">{status}</div>}
      </main>
    </>
  )
}
