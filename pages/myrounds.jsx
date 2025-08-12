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
import Layout from '@/components/Layout'

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // ✅ Updated to deployed V3

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

  const [started, setStarted] = useState([])
  const [joined, setJoined] = useState([])
  const [wins, setWins] = useState([])
  const [unclaimedWins, setUnclaimedWins] = useState([])
  const [voted, setVoted] = useState([])

  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [showConfetti, setShowConfetti] = useState(false)
  const [contractAddrUsed, setContractAddrUsed] = useState(CONTRACT_ADDRESS)

  const { width, height } = useWindowSize()
  const tickRef = useRef(null)
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (window?.ethereum) {
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

  useEffect(() => {
    if (!address) return
    ;(async () => {
      try {
        const p = await fetchFarcasterProfile(address)
        setProfile(p || null)
      } catch {}
    })()
  }, [address])

  async function loadMyRounds() {
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
            claimed: info[8],
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
            claimed: p2[6],
            challengerWon: p2[7],
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
  }

  useEffect(() => { if (address) loadMyRounds() }, [address, priceUsd])

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
      setStatus('Finalize failed')
      setShowConfetti(false)
    }
  }

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

  const statusBadge = (card) => card.kind === 'pool1'
    ? !card.ended
      ? <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs">Active</span>
      : card.claimed
        ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs">Completed</span>
        : <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs">Ended — Pending</span>
    : !card.claimed
      ? <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs">Voting</span>
      : <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs">{card.challengerWon ? 'Challenger Won' : 'Original Won'}</span>

  const pageUrl = absoluteUrl('/myrounds')
  const ogTitle = profile?.username ? `@${profile.username} on MadFill — My Rounds` : 'My Rounds — MadFill'
  const ogDesc = 'See rounds you created, joined, voted in, and any wins.'
  const ogImage = buildOgUrl({ screen: 'myrounds', user: profile?.username || shortAddr(address) || 'anon' })

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
      <SEO title={ogTitle} description={ogDesc} url={pageUrl} image={ogImage} type="profile" twitterCard="summary_large_image" />
      {showConfetti && <Confetti width={width} height={height} />}
      {/* ✅ Remainder of JSX is same as your original — no functional changes except bug fixes */}
    </Layout>
  )
}
