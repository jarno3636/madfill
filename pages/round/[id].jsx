// pages/round/[id].jsx
'use client'

import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryV3_ABI.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import Link from 'next/link'
import Image from 'next/image'
import { fetchFarcasterProfile } from '@/lib/neynar'

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x6975a550130642E5cb67A87BE25c8134542D5a0a' // FillInStoryV3

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID_HEX = '0x2105' // 8453 Base

export default function RoundDetailPage() {
  const router = useRouter()
  const idParam = router?.query?.id
  const id = useMemo(() => (Array.isArray(idParam) ? idParam[0] : idParam), [idParam])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [address, setAddress] = useState(null)
  const [isOnBase, setIsOnBase] = useState(true)

  const [round, setRound] = useState(null)
  const [submissions, setSubmissions] = useState([]) // [{addr, username, wordRaw, word, index, preview}]
  const [profiles, setProfiles] = useState({}) // addrLower -> {username,pfp_url}

  const [wordInput, setWordInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [selectedBlank, setSelectedBlank] = useState(0)
  const [inputError, setInputError] = useState('')
  const [status, setStatus] = useState('')

  const [priceUsd, setPriceUsd] = useState(3800) // ETH-USD fallback
  const [claimedNow, setClaimedNow] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  const { width, height } = useWindowSize()
  const tickRef = useRef(null)

  // ---------- utils ----------
  const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
  const toEth = (wei) => (wei ? Number(ethers.formatEther(wei)) : 0)
  const fmt = (n, d = 2) => new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n)
  const explorer = (path) => `https://basescan.org/${path}`

  // Parse stored submission "index::word" or plain "word"
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

  // need a space if the next chunk doesn't already start with whitespace or punctuation
  const needsSpaceBefore = (str) => {
    if (!str) return false
    const ch = str[0]
    return !(/\s/.test(ch) || /[.,!?;:)"'\]]/.test(ch))
  }

  // Build preview for a single chosen blank (others as ____), with smart spacing.
  function buildPreviewSingle(parts, word, blankIndex) {
    const n = parts?.length || 0
    if (n === 0) return ''
    const blanks = Math.max(0, n - 1)
    const idx = Math.max(0, Math.min(Math.max(0, blanks - 1), blankIndex || 0))
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

  // Build preview from stored submission value ("index::word" or "word")
  function buildPreviewFromStored(parts, stored) {
    const { index, word } = parseStoredWord(stored)
    return buildPreviewSingle(parts, word, index)
  }

  const ended = useMemo(() => {
    if (!round?.deadline) return false
    return Math.floor(Date.now() / 1000) >= Number(round.deadline)
  }, [round?.deadline])

  const youWon = useMemo(() => {
    if (!address || !round?.winner || round?.winner === '0x0000000000000000000000000000000000000000') return false
    return address.toLowerCase() === round.winner.toLowerCase()
  }, [address, round?.winner])

  const alreadyEntered = useMemo(() => {
    if (!address || !submissions?.length) return false
    return submissions.some((s) => s.addr.toLowerCase() === address.toLowerCase())
  }, [address, submissions])

  const timeLeft = useMemo(() => {
    if (!round?.deadline) return ''
    const s = Math.max(0, Number(round.deadline) - Math.floor(Date.now() / 1000))
    if (s === 0) return 'Ended'
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m ${sec}s`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
  }, [round?.deadline, status])

  const blanksCount = useMemo(() => Math.max(0, (round?.parts?.length || 0) - 1), [round?.parts])

  // which blanks are already taken by submissions
  const takenBlanks = useMemo(() => {
    if (!submissions?.length || blanksCount === 0) return new Set()
    const set = new Set()
    for (const s of submissions) {
      const idx = Number(s.index ?? 0)
      if (idx >= 0 && idx < blanksCount) set.add(idx)
    }
    return set
  }, [submissions, blanksCount])

  // auto-pick first available blank on load/change
  useEffect(() => {
    if (!blanksCount) return
    const firstOpen = [...Array(blanksCount).keys()].find((i) => !takenBlanks.has(i))
    if (firstOpen !== undefined) setSelectedBlank(firstOpen)
  }, [blanksCount, takenBlanks])

  // ---------- wallet + chain ----------
  useEffect(() => {
    if (!window?.ethereum) return
    let cancelled = false
    ;(async () => {
      try {
        const accts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        if (!cancelled) setAddress(accts?.[0] || null)
      } catch {}
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const net = await provider.getNetwork()
        if (!cancelled) setIsOnBase(net?.chainId === 8453n)
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
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function switchToBase() {
    if (!window?.ethereum) return
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      })
      setIsOnBase(true)
    } catch (e) {
      if (e?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: BASE_CHAIN_ID_HEX,
                chainName: 'Base',
                rpcUrls: [BASE_RPC],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                blockExplorerUrls: ['https://basescan.org'],
              },
            ],
          })
          setIsOnBase(true)
        } catch (err) {
          console.error(err)
        }
      }
    }
  }

  // ---------- price + share url + ticker ----------
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
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.origin + router.asPath)
    }
    tickRef.current = setInterval(() => setStatus((s) => (s ? s : '')), 1000)
    return () => clearInterval(tickRef.current)
  }, [router.asPath])

  // ---------- load pool1 from V3 ----------
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider(BASE_RPC)
        const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)

        // V3: getPool1Info => (name, theme, parts, feeBase, deadline, creator, participants, winner, claimed, poolBalance)
        const info = await ct.getPool1Info(BigInt(id))

        const name = info[0]
        const theme = info[1]
        const parts = info[2]
        const feeBase = info[3] // bigint
        const deadline = Number(info[4])
        const creator = info[5]
        const participants = info[6]
        const winner = info[7]
        const claimed = info[8]
        const poolBalance = info[9] // bigint

        // Pull each participant's submission via V3: getPool1Submission(id, addr) => (username, word, submitter)
        const subms = await Promise.all(
          participants.map(async (addr) => {
            const s = await ct.getPool1Submission(BigInt(id), addr)
            const username = s[0]
            const wordRaw = s[1]
            const parsed = parseStoredWord(wordRaw)
            const preview = buildPreviewSingle(parts, parsed.word, parsed.index)
            return { addr, username, wordRaw, word: parsed.word, index: parsed.index, preview }
          })
        )

        const creatorSub = subms.find((s) => s.addr.toLowerCase() === creator.toLowerCase())

        // Prefetch Farcaster profiles (bounded)
        const toLookup = Array.from(
          new Set(
            subms
              .slice(0, 24)
              .map((x) => x.addr.toLowerCase())
              .concat(creator?.toLowerCase() || [])
              .concat(winner ? winner.toLowerCase() : [])
          )
        )

        const profileMap = {}
        await Promise.all(
          toLookup.map(async (addr) => {
            try {
              const p = await fetchFarcasterProfile(addr)
              if (p) profileMap[addr] = p
            } catch {}
          })
        )

        if (cancelled) return
        setProfiles(profileMap)
        setSubmissions(subms)
        setRound({
          id,
          name: name || `Round #${id}`,
          theme,
          parts,
          feeBase,
          deadline,
          creator,
          winner,
          claimed,
          poolBalance,
          creatorPreview: buildPreviewFromStored(parts, creatorSub?.wordRaw || ''),
          entrants: participants.length,
        })

        // clamp any previous selection
        setSelectedBlank((prev) => Math.min(Math.max(prev, 0), Math.max(0, parts.length - 2)))
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e?.shortMessage || e?.message || 'Failed to load round')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  // ---------- input handling ----------
  function sanitizeWord(raw) {
    // allow letters, numbers, hyphen, underscore; single token; max 16 chars
    const token = (raw || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')[0]
      .replace(/[^a-zA-Z0-9\-_]/g, '')
      .slice(0, 16)
    return token
  }

  function onWordChange(e) {
    const clean = sanitizeWord(e.target.value)
    setWordInput(clean)
    if (!clean) {
      setInputError('Please enter one word (max 16 chars).')
    } else {
      setInputError('')
    }
  }

  // ---------- actions (V3) ----------
  async function handleJoin() {
    try {
      if (!window?.ethereum) throw new Error('Wallet not found')
      if (!round) throw new Error('Round not ready')
      if (!wordInput.trim()) throw new Error('Please enter one word')
      if (inputError) throw new Error(inputError)
      if (alreadyEntered) throw new Error('You already entered this round')
      if (takenBlanks.has(selectedBlank)) throw new Error('That blank is already taken. Pick a different one.')

      const encodedWord = `${selectedBlank}::${wordInput}`

      setStatus('Submitting your entry…')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const net = await provider.getNetwork()
      if (net?.chainId !== 8453n) {
        await switchToBase()
      }
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)
      // V3 joinPool1(uint256 id, string word, string username) payable
      const tx = await ct.joinPool1(BigInt(id), encodedWord, usernameInput || '', { value: round.feeBase })
      await tx.wait()
      setStatus('Entry submitted!')
      setShowConfetti(true)
      router.replace(router.asPath)
    } catch (e) {
      console.error(e)
      setStatus('Join failed')
      setShowConfetti(false)
    }
  }

  async function handleFinalizePayout() {
    try {
      if (!window?.ethereum) throw new Error('Wallet not found')
      if (!round) throw new Error('Round not ready')
      setStatus('Finalizing and paying out…')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const net = await provider.getNetwork()
      if (net?.chainId !== 8453n) {
        await switchToBase()
      }
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)
      // V3 claimPool1(uint256 id) — anyone can call after deadline; pays winner immediately
      const tx = await ct.claimPool1(BigInt(id))
      await tx.wait()
      setStatus('Payout executed')
      setClaimedNow(true)
      setShowConfetti(true)
      setTimeout(() => router.replace(router.asPath), 1500)
    } catch (e) {
      console.error(e)
      setStatus('Finalize failed')
      setShowConfetti(false)
    }
  }

  // ---------- render ----------
  const feeEth = toEth(round?.feeBase)
  const poolEth = toEth(round?.poolBalance)
  const feeUsd = feeEth * priceUsd
  const poolUsd = poolEth * priceUsd
  const canJoin =
    !ended &&
    !alreadyEntered &&
    !!wordInput.trim() &&
    !inputError &&
    blanksCount > 0 &&
    !takenBlanks.has(selectedBlank)
  const canFinalize = ended && !round?.claimed && !claimedNow && (round?.entrants || 0) > 0

  // label for blank options: show a tiny context preview around each blank
  const blankLabels = useMemo(() => {
    const p = round?.parts || []
    const labels = []
    const blanks = Math.max(0, p.length - 1)
    for (let i = 0; i < blanks; i++) {
      const left = (p[i] || '').trim().slice(-10)
      const right = (p[i + 1] || '').trim().slice(0, 10)
      labels.push(`Blank #${i + 1} — "…${left} ____ ${right}…"`)
    }
    return labels
  }, [round?.parts])

  return (
    <Layout>
      <Head>
        <title>{round?.name ? `${round.name} — MadFill` : id ? `MadFill Round #${id}` : 'MadFill Round'}</title>
        <meta name="description" content="Join a MadFill round on Base. Fill the blank, compete, and win the pot." />
        {shareUrl ? <meta property="og:url" content={shareUrl} /> : null}
        <meta property="og:title" content={round?.name || `MadFill Round #${id}`} />
        <meta property="og:description" content="Join this MadFill round, add your words, and win the prize pool on Base." />
      </Head>

      <main className="max-w-5xl mx-auto p-4 md:p-6 text-white">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm">
            {round?.name || (id ? `Round #${id}` : 'Round')}
          </h1>
          <div className="mt-2 text-sm text-slate-300">
            <span className="mr-2">🎨 {round?.theme || 'General'}</span>
            <span className="mx-2">•</span>
            <span className="mr-2">⌛ {ended ? 'Ended' : `Time left: ${timeLeft}`}</span>
            <span className="mx-2">•</span>
            <a className="underline decoration-dotted" href={explorer(`address/${CONTRACT_ADDRESS}`)} target="_blank" rel="noreferrer">
              View Contract
            </a>
          </div>
        </div>

        {/* Status / Errors */}
        {loading && <div className="rounded-xl bg-slate-900/70 p-6 animate-pulse text-slate-300">Loading round…</div>}
        {error && (
          <div className="rounded-xl bg-red-900/40 border border-red-500/40 p-4 text-red-200">
            Error: {error}
          </div>
        )}

        {/* Body */}
        {!loading && !error && round && (
          <>
            {/* Hero cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
                <CardHeader className="text-center font-bold bg-slate-800/60 border-b border-slate-700">
                  😂 Original Card
                </CardHeader>
                <CardContent className="p-5 min-h-[140px]">
                  <p className="text-center italic text-lg leading-relaxed">{round.creatorPreview}</p>
                  <div className="mt-3 text-center text-slate-300 text-sm">
                    by{' '}
                    <a
                      className="underline decoration-dotted"
                      href={
                        profiles[round.creator?.toLowerCase()]?.username
                          ? `https://warpcast.com/${profiles[round.creator?.toLowerCase()]?.username}`
                          : explorer(`address/${round.creator}`)
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {profiles[round.creator?.toLowerCase()]?.username
                        ? `@${profiles[round.creator?.toLowerCase()]?.username}`
                        : shortAddr(round.creator)}
                    </a>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
                <CardHeader className="text-center font-bold bg-slate-800/60 border-b border-slate-700">
                  ✍️ Enter This Round
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <label className="block text-sm text-slate-300">
                      Your username (optional)
                      <input
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value.slice(0, 32))}
                        placeholder="e.g., frogtown"
                        className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </label>

                    {/* Blank picker */}
                    <div className="space-y-2">
                      <div className="text-sm text-slate-300">Choose a blank</div>
                      {blanksCount === 0 ? (
                        <div className="text-xs text-amber-300">This template has no blanks.</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {[...Array(blanksCount).keys()].map((i) => {
                            const isTaken = takenBlanks.has(i)
                            const isActive = selectedBlank === i
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => !isTaken && setSelectedBlank(i)}
                                disabled={isTaken}
                                className={[
                                  'px-3 py-1 rounded-lg border text-sm',
                                  isTaken
                                    ? 'bg-slate-800/40 border-slate-700 text-slate-500 cursor-not-allowed'
                                    : isActive
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-800/70 border-slate-700 text-slate-200 hover:bg-slate-700/70'
                                ].join(' ')}
                                title={isTaken ? 'Already taken by another entry' : `Insert into Blank #${i + 1}`}
                              >
                                #{i + 1} {isTaken ? '— Taken' : ''}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <label className="block text-sm text-slate-300">
                      Your word (single word, max 16 chars)
                      <input
                        value={wordInput}
                        onChange={onWordChange}
                        placeholder="e.g., neon"
                        className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </label>
                    {inputError && <div className="text-xs text-amber-300">{inputError}</div>}

                    <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-sm">
                      <div className="text-slate-300">Preview</div>
                      <div className="mt-1 italic">
                        {buildPreviewSingle(round.parts, wordInput, selectedBlank)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Entry Fee: {fmt(feeEth, 6)} ETH (~${fmt(feeUsd)})
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Entrants: {round.entrants}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Prize Pool: {fmt(poolEth, 6)} ETH (~${fmt(poolUsd)})
                      </span>
                    </div>

                    {blanksCount > 0 && takenBlanks.size === blanksCount && (
                      <div className="text-xs text-amber-300">All blanks are already taken for this round.</div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      {!isOnBase && (
                        <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600">
                          Switch to Base
                        </Button>
                      )}
                      <Button
                        onClick={handleJoin}
                        className="bg-green-600 hover:bg-green-500"
                        disabled={!canJoin}
                        title={
                          ended
                            ? 'Round ended'
                            : alreadyEntered
                            ? 'You already entered'
                            : takenBlanks.has(selectedBlank)
                            ? 'That blank is taken'
                            : inputError
                            ? inputError
                            : 'Join this round'
                        }
                      >
                        Join Round
                      </Button>
                      {alreadyEntered && !ended && (
                        <span className="text-xs text-amber-300">You already entered this round.</span>
                      )}
                      <span className="text-xs text-slate-400">
                        USD is informational. Fees handled on-chain.
                      </span>
                    </div>

                    {status && <div className="text-yellow-300 text-sm">{status}</div>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stats + actions */}
            <div className="mt-6 rounded-xl bg-slate-900/70 border border-slate-700 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-300">
                  Status:{' '}
                  <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                    {ended ? (round.claimed || claimedNow ? 'Completed' : 'Ended — Pending Payout') : `Time left: ${timeLeft}`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {canFinalize && (
                    <Button onClick={handleFinalizePayout} className="bg-indigo-600 hover:bg-indigo-500" title="Anyone can finalize after the deadline.">
                      Finalize & Payout
                    </Button>
                  )}
                  {round.claimed && round.winner && (
                    <span className="text-sm text-green-400">
                      Winner:{' '}
                      <a
                        className="underline decoration-dotted"
                        href={
                          profiles[round.winner?.toLowerCase()]?.username
                            ? `https://warpcast.com/${profiles[round.winner?.toLowerCase()]?.username}`
                            : explorer(`address/${round.winner}`)
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        {profiles[round.winner?.toLowerCase()]?.username
                          ? `@${profiles[round.winner?.toLowerCase()]?.username}`
                          : shortAddr(round.winner)}
                      </a>
                    </span>
                  )}
                  {youWon && (round.claimed || claimedNow) && (
                    <span className="text-sm font-semibold text-emerald-300">You won this round!</span>
                  )}
                </div>
              </div>
            </div>

            {/* Entrants */}
            <div className="mt-6 rounded-xl bg-slate-900/70 border border-slate-700 p-5">
              <div className="text-slate-200 mb-3">Entrants ({submissions.length})</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {submissions.map((s, i) => {
                  const p = profiles[s.addr.toLowerCase()]
                  const name = p?.username ? `@${p.username}` : s.username || shortAddr(s.addr)
                  const avatar = p?.pfp_url || `https://effigy.im/a/${s.addr}`
                  const wcMsg = `gm ${p?.username ? `@${p.username}` : shortAddr(s.addr)} — saw your entry in MadFill round #${id}!`
                  return (
                    <div key={`${s.addr}-${i}`} className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                      <div className="flex items-center gap-2">
                        <Image
                          src={avatar}
                          alt="avatar"
                          width={28}
                          height={28}
                          className="rounded-full ring-1 ring-slate-700"
                        />
                        <div className="truncate text-sm">{name}</div>
                      </div>
                      <div className="mt-2 text-xs italic line-clamp-3">{s.preview}</div>
                      <div className="mt-2 flex items-center gap-3 text-[11px]">
                        <a
                          className="underline text-purple-300"
                          target="_blank"
                          rel="noreferrer"
                          href={`https://warpcast.com/~/compose?text=${encodeURIComponent(wcMsg)}`}
                        >
                          Message
                        </a>
                        <a
                          className="underline text-slate-300"
                          target="_blank"
                          rel="noreferrer"
                          href={explorer(`address/${s.addr}`)}
                        >
                          Explorer
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Social & nav */}
            <div className="mt-6 rounded-xl bg-slate-900/70 border border-slate-700 p-5">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-slate-300">Share this round:</span>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `Join my MadFill round: ${round.name} — ${shareUrl}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-blue-400"
                >
                  Twitter/X
                </a>
                <a
                  href={`https://warpcast.com/~/compose?text=${encodeURIComponent(
                    `Join my MadFill round: ${round.name} — ${shareUrl}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-purple-300"
                >
                  Warpcast
                </a>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl)
                      setStatus('Link copied')
                      setTimeout(() => setStatus((s) => (s === 'Link copied' ? '' : s)), 1500)
                    } catch {}
                  }}
                  className="underline text-slate-200"
                >
                  Copy link
                </button>
                <span className="mx-2 text-slate-500">|</span>
                <Link href="/active" className="underline text-indigo-300">
                  ← Back to Active Rounds
                </Link>
              </div>
            </div>

            {(showConfetti || (youWon && (round.claimed || claimedNow))) && <Confetti width={width} height={height} />}
          </>
        )}
      </main>
    </Layout>
  )
}
