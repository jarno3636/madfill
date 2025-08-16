// pages/round/[id].jsx
'use client'

import { useRouter } from 'next/router'
import { useEffect, useMemo, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import Link from 'next/link'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'

import abi from '@/abi/FillInStoryV3_ABI.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import SEO from '@/components/SEO'
import ShareBar from '@/components/ShareBar'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'

// ✅ Unified Tx provider (single source of truth)
import { useTx } from '@/components/TxProvider'

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

/* ---------- Error helpers ---------- */
function extractDeepError(e) {
  const guess =
    e?.shortMessage ||
    e?.reason ||
    e?.error?.message ||
    e?.info?.error?.message ||
    e?.data?.message ||
    e?.message
  const payload = e?.data || e?.error?.data || e?.info?.error?.data || null
  if (!payload) return guess || 'Transaction failed'
  try {
    const iface = new ethers.Interface(['function Error(string)'])
    const [reason] = iface.decodeErrorResult('Error', payload)
    if (reason) return String(reason)
  } catch {}
  try {
    const panicIface = new ethers.Interface(['function Panic(uint256)'])
    const [code] = panicIface.decodeErrorResult('Panic', payload)
    if (code) return `Panic: 0x${BigInt(code).toString(16)}`
  } catch {}
  return guess || 'Transaction would revert'
}

/* ---------- Text helpers ---------- */
const needsSpaceBefore = (str) => {
  if (!str) return false
  const ch = str[0]
  return !(/\s/.test(ch) || /[.,!?;:)"'\]]/.test(ch))
}

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

/* ===================================================== */

export default function RoundDetailPage() {
  useMiniAppReady()

  const router = useRouter()
  const isReady = router?.isReady
  const idParam = isReady ? router.query?.id : undefined
  const id = useMemo(() => (Array.isArray(idParam) ? idParam[0] : idParam), [idParam])

  // ✅ Tx context: address, chain status, helpers, and BASE RPC
  const {
    address,
    isOnBase,
    switchToBase,
    joinPool1,
    claimPool1,
    BASE_RPC,
  } = useTx()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [round, setRound] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [takenSet, setTakenSet] = useState(new Set())

  const [wordInput, setWordInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [selectedBlank, setSelectedBlank] = useState(0)
  const [inputError, setInputError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const [priceUsd, setPriceUsd] = useState(3800)
  const [claimedNow, setClaimedNow] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  const { width, height } = useWindowSize()
  const [tick, setTick] = useState(0)

  const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
  const toEth = (wei) => {
    try {
      if (wei == null) return 0
      const bi = typeof wei === 'bigint' ? wei : BigInt(wei.toString())
      return Number(ethers.formatEther(bi))
    } catch { return 0 }
  }
  const fmt = (n, d = 2) => new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n)
  const explorer = (path) => `https://basescan.org/${path}`

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
    return submissions.some((s) => s.addr?.toLowerCase?.() === address.toLowerCase())
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
  }, [round?.deadline, tick])

  const blanksCount = useMemo(() => Math.max(0, (round?.parts?.length || 0) - 1), [round?.parts])

  useEffect(() => {
    if (!blanksCount) return
    const firstOpen = [...Array(blanksCount).keys()].find((i) => !takenSet.has(i))
    if (firstOpen !== undefined) setSelectedBlank(firstOpen)
    else setSelectedBlank((i) => Math.min(i, Math.max(0, blanksCount - 1)))
  }, [blanksCount, takenSet])

  /* ---------- price + share + tick ---------- */
  useEffect(() => {
    if (!isReady) return
    ;(async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const j = await r.json()
        setPriceUsd(j?.ethereum?.usd || 3800)
      } catch { setPriceUsd(3800) }
    })()
    setShareUrl(absoluteUrl(router.asPath || `/round/${id || ''}`))
    const intId = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(intId)
  }, [router.asPath, id, isReady])

  /* ---------- load round (read-only provider) ---------- */
  useEffect(() => {
    if (!isReady || !id) return
    let cancelled = false
    setLoading(true); setError(null)

    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider(BASE_RPC)
        const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)

        const info = await ct.getPool1Info(BigInt(id))
        const name = info.name_ ?? info[0]
        const theme = info.theme_ ?? info[1]
        const parts = info.parts_ ?? info[2]
        const feeBase = info.feeBase_ ?? info[3]
        const deadline = Number(info.deadline_ ?? info[4])
        const creator = info.creator_ ?? info[5]
        const participants = info.participants_ ?? info[6]
        const winner = info.winner_ ?? info[7]
        const claimed = info.claimed_ ?? info[8]
        const poolBalance = info.poolBalance_ ?? info[9]

        let subms = []
        let takenSetLocal = new Set()
        try {
          const packed = await ct.getPool1SubmissionsPacked(BigInt(id))
          const addrs = packed.addrs || packed[0] || []
          const usernames = packed.usernames || packed[1] || []
          const words = packed.words || packed[2] || []
          const blankIdxs = packed.blankIndexes || packed[3] || []
          subms = addrs.map((addr, i) => {
            const username = usernames[i] || ''
            const word = words[i] || ''
            const idx = Number(blankIdxs[i] ?? 0)
            return { addr, username, word, index: idx, preview: buildPreviewSingle(parts, word, idx) }
          })
        } catch {}

        if (subms.length === 0 && (participants?.length || 0) > 0) {
          subms = await Promise.all(
            (participants || []).map(async (addr) => {
              try {
                const s = await ct.getPool1Submission(BigInt(id), addr)
                const username = s?.[0] || ''
                const word = s?.[1] || ''
                const idx = Number(s?.[3] ?? 0)
                return { addr, username, word, index: idx, preview: buildPreviewSingle(parts, word, idx) }
              } catch {
                return { addr, username: '', word: '', index: 0, preview: buildPreviewSingle(parts, '', 0) }
              }
            })
          )
        }

        try {
          const taken = await ct.getPool1Taken(BigInt(id))
          takenSetLocal = new Set((taken || []).map((b, i) => (b ? i : null)).filter((x) => x !== null))
        } catch {
          takenSetLocal = new Set(subms.map((s) => s.index))
        }

        if (cancelled) return
        setTakenSet(takenSetLocal)
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
          entrants: participants?.length ?? subms.length,
        })
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(extractDeepError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [id, isReady, BASE_RPC])

  /* ---------- inputs ---------- */
  function sanitizeWord(raw) {
    return (raw || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')[0]
      .replace(/[^a-zA-Z0-9\-_]/g, '')
      .slice(0, 16)
  }
  function onWordChange(e) {
    const clean = sanitizeWord(e.target.value)
    setWordInput(clean)
    setInputError(clean ? '' : 'Please enter one word (max 16 chars).')
  }

  /* ---------- actions (use Tx helpers) ---------- */
  const handleJoin = useCallback(async () => {
    try {
      if (!round) throw new Error('Round not ready')
      if (ended) throw new Error('Round ended')
      if (!wordInput.trim()) throw new Error('Please enter one word')
      if (inputError) throw new Error(inputError)
      if (alreadyEntered) throw new Error('You already entered this round')
      if (takenSet.has(selectedBlank)) throw new Error('That blank is already taken')

      setBusy(true); setStatus('Submitting your entry…')

      const ok = await switchToBase()
      if (!ok) throw new Error('Please switch to Base')

      const feeBaseWei = round.feeBase ?? 0n
      if (feeBaseWei <= 0n) throw new Error('Entry fee not available yet, try again.')

      await joinPool1({
        id,
        word: sanitizeWord(wordInput),
        username: (usernameInput || '').trim().slice(0, 32),
        blankIndex: Number(selectedBlank),
        feeBaseWei: BigInt(feeBaseWei),
      })

      setStatus('Entry submitted!'); setShowConfetti(true)
      router.replace(router.asPath)
    } catch (e) {
      console.error(e)
      setStatus(extractDeepError(e).split('\n')[0])
      setShowConfetti(false)
    } finally { setBusy(false) }
  }, [round, ended, wordInput, inputError, alreadyEntered, takenSet, selectedBlank, switchToBase, joinPool1, usernameInput, id, router])

  const handleFinalizePayout = useCallback(async () => {
    try {
      if (!round) throw new Error('Round not ready')
      setBusy(true); setStatus('Finalizing and paying out…')

      const ok = await switchToBase()
      if (!ok) throw new Error('Please switch to Base')

      await claimPool1(id)

      setStatus('Payout executed'); setClaimedNow(true); setShowConfetti(true)
      setTimeout(() => router.replace(router.asPath), 1500)
    } catch (e) {
      console.error(e)
      setStatus(extractDeepError(e).split('\n')[0])
      setShowConfetti(false)
    } finally { setBusy(false) }
  }, [round, switchToBase, claimPool1, id, router])

  /* ---------- derived for ShareBar ---------- */
  const feeEthNum = useMemo(() => toEth(round?.feeBase), [round?.feeBase])
  const feeEthStr = useMemo(() => (Number.isFinite(feeEthNum) ? feeEthNum.toFixed(4) : '0.0000'), [feeEthNum])
  const minutesLeft = useMemo(() => {
    if (!round?.deadline) return 60
    const s = Math.max(0, Number(round.deadline) - Math.floor(Date.now() / 1000))
    return Math.max(1, Math.round(s / 60))
  }, [round?.deadline, tick])

  const poolEth = useMemo(() => toEth(round?.poolBalance), [round?.poolBalance])
  const feeUsd = feeEthNum * priceUsd
  const poolUsd = poolEth * priceUsd

  const canJoin =
    !ended &&
    !alreadyEntered &&
    !!wordInput.trim() &&
    !inputError &&
    blanksCount > 0 &&
    !takenSet.has(selectedBlank) &&
    !busy

  const canFinalize = ended && !round?.claimed && !claimedNow && (round?.entrants || 0) > 0 && !busy

  /* ---------- SEO ---------- */
  const pageTitle = round?.name ? `${round.name} — MadFill` : id ? `MadFill Round #${id}` : 'MadFill Round'
  const pageDesc = 'Join a MadFill round on Base. Fill the blank, compete, and win the pot.'
  const pageUrl = shareUrl || absoluteUrl(`/round/${id || ''}`)
  const ogImage = buildOgUrl({ screen: 'round', roundId: String(id || '') })

  return (
    <Layout>
      <Head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="Open Round" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
      </Head>
      <SEO title={pageTitle} description={pageDesc} url={pageUrl} image={ogImage} />

      <main className="max-w-5xl mx-auto p-4 md:p-6 text-white">
        <div className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm">
            {round?.name || (id ? `Round #${id}` : 'Round')}
          </h1>
          <div className="mt-2 text-sm text-slate-300">
            <span className="mr-2">🎨 {round?.theme || 'General'}</span>
            <span className="mx-2">•</span>
            <span className="mr-2">⌛ {round ? (ended ? 'Ended' : `Time left: ${timeLeft}`) : '—'}</span>
            <span className="mx-2">•</span>
            <a className="underline decoration-dotted" href={explorer(`address/${CONTRACT_ADDRESS}`)} target="_blank" rel="noopener noreferrer">
              View Contract
            </a>
          </div>
        </div>

        {loading && <div className="rounded-xl bg-slate-900/70 p-6 animate-pulse text-slate-300">Loading round…</div>}
        {error && <div className="rounded-xl bg-red-900/40 border border-red-500/40 p-4 text-red-200">Error: {error}</div>}

        {!loading && !error && round && (
          <>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
                <CardHeader className="text-center font-bold bg-slate-800/60 border-b border-slate-700">
                  😂 Original Card
                </CardHeader>
                <CardContent className="p-5 min-h-[140px]">
                  <p className="text-center italic text-lg leading-relaxed">
                    {(() => {
                      const creatorSub = submissions.find(
                        (s) => s.addr?.toLowerCase?.() === round.creator?.toLowerCase?.()
                      )
                      return creatorSub?.preview || buildPreviewSingle(round.parts, '', 0)
                    })()}
                  </p>
                  <div className="mt-3 text-center text-slate-300 text-sm">
                    by{' '}
                    <a className="underline decoration-dotted" href={explorer(`address/${round.creator}`)} target="_blank" rel="noopener noreferrer">
                      {shortAddr(round.creator)}
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
                        disabled={busy}
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
                            const isTaken = takenSet.has(i)
                            const isActive = selectedBlank === i
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => !isTaken && setSelectedBlank(i)}
                                disabled={isTaken || busy}
                                className={[
                                  'px-3 py-1 rounded-lg border text-sm',
                                  isTaken
                                    ? 'bg-slate-800/40 border-slate-700 text-slate-500 cursor-not-allowed'
                                    : isActive
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-800/70 border-slate-700 text-slate-200 hover:bg-slate-700/70',
                                ].join(' ')}
                                title={isTaken ? 'Already taken by another entry' : `Insert into Blank #${i + 1}`}
                              >
                                #{i + 1}
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
                        onBlur={() => setWordInput((w) => sanitizeWord(w))}
                        placeholder="e.g., neon"
                        className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                        disabled={busy || blanksCount === 0}
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
                        Entry Fee: {fmt(feeEthNum, 6)} ETH (~${fmt(feeUsd)})
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Entrants: {round.entrants}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700">
                        Prize Pool: {fmt(poolEth, 6)} ETH (~${fmt(poolUsd)})
                      </span>
                    </div>

                    {blanksCount > 0 && takenSet.size === blanksCount && (
                      <div className="text-xs text-amber-300">All blanks are already taken for this round.</div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      {!isOnBase && (
                        <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600" disabled={busy}>
                          Switch to Base
                        </Button>
                      )}
                      <Button
                        onClick={handleJoin}
                        className="bg-green-600 hover:bg-green-500"
                        disabled={!canJoin}
                        title={
                          ended ? 'Round ended'
                            : alreadyEntered ? 'You already entered'
                            : takenSet.has(selectedBlank) ? 'That blank is taken'
                            : inputError ? inputError
                            : busy ? 'Submitting…'
                            : 'Join this round'
                        }
                      >
                        {busy ? 'Submitting…' : 'Join Round'}
                      </Button>
                      <span className="text-xs text-slate-400">USD is informational. Fees handled on-chain.</span>
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
                      {busy ? 'Finalizing…' : 'Finalize & Payout'}
                    </Button>
                  )}
                  {round.claimed && round.winner && (
                    <span className="text-sm text-green-400">
                      Winner:{' '}
                      <a className="underline decoration-dotted" href={explorer(`address/${round.winner}`)} target="_blank" rel="noopener noreferrer">
                        {shortAddr(round.winner)}
                      </a>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Entrants */}
            <div className="mt-6 rounded-xl bg-slate-900/70 border border-slate-700 p-5">
              <div className="text-slate-200 mb-3">Entrants ({submissions.length})</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {submissions.map((s, i) => {
                  const primary = `https://effigy.im/a/${s.addr}`
                  return (
                    <div key={`${s.addr}-${i}`} className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={primary}
                          alt="avatar"
                          width={28}
                          height={28}
                          className="rounded-full ring-1 ring-slate-700"
                          onError={(e) => { e.currentTarget.src = '/Capitalize.PNG' }}
                        />
                        <div className="truncate text-sm">{s.username || shortAddr(s.addr)}</div>
                      </div>
                      <div className="mt-2 text-xs italic line-clamp-3">{s.preview}</div>
                      <div className="mt-2 flex items-center gap-3 text-[11px]">
                        <a className="underline text-slate-300" target="_blank" rel="noopener noreferrer" href={explorer(`address/${s.addr}`)}>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ShareBar
                  url={absoluteUrl(`/round/${id}`)}
                  title={`🧠 Play MadFill Round #${id}!`}
                  theme={round?.theme || 'MadFill'}
                  templateName={round?.name || `Round #${id}`}
                  feeEth={feeEthStr}
                  durationMins={minutesLeft}
                  word={wordInput || undefined}
                  blankIndex={selectedBlank}
                  hashtags={['MadFill','Base','Farcaster']}
                  embed="/og/cover.PNG"
                />
                <Link href="/active" className="underline text-indigo-300">
                  ← Back to Active Rounds
                </Link>
              </div>
            </div>

            {(showConfetti || (youWon && (round.claimed || claimedNow))) && width > 0 && height > 0 && (
              <Confetti width={width} height={height} />
            )}
          </>
        )}
      </main>
    </Layout>
  )
}
