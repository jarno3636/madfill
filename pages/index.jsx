// pages/index.jsx
'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '@/abi/FillInStoryV3_ABI.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { categories, durations } from '@/data/templates'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import ShareBar from '@/components/ShareBar'
import { fetchFarcasterProfile } from '@/lib/neynar'
import SEO from '@/components/SEO'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // FillInStoryV3 on Base

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const FEATURED_TAKE = 9

const extractError = (e) =>
  e?.shortMessage ||
  e?.reason ||
  e?.error?.message ||
  e?.data?.message ||
  e?.message ||
  (typeof e === 'string' ? e : JSON.stringify(e))

export default function Home() {
  // status + logs
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState([])
  const loggerRef = useRef(null)

  // passive wallet signal (no UI here—wallet lives in Layout)
  const [address, setAddress] = useState(null)

  // form state
  const [roundId, setRoundId] = useState('')
  const [roundName, setRoundName] = useState('')
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [blankIndex, setBlankIndex] = useState(0)
  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(durations[0].value) // days
  const [feeEth, setFeeEth] = useState(0.01) // ETH on Base
  const [busy, setBusy] = useState(false)

  // flair + confetti
  const [profile, setProfile] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)

  // featured
  const [featured, setFeatured] = useState([])
  the [loadingFeatured, setLoadingFeatured] = useState(true)

  const { width, height } = useWindowSize()
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx] // { name, parts, blanks }

  const log = (msg) => {
    setLogs((prev) => [...prev, msg])
    setTimeout(() => {
      if (loggerRef.current) loggerRef.current.scrollTop = loggerRef.current.scrollHeight
    }, 30)
  }

  const needsSpaceBefore = (str) => {
    if (!str) return false
    const ch = str[0]
    return !(/\s/.test(ch) || /[.,!?;:)"'\]]/.test(ch))
  }

  function buildPreviewSingle(parts, w, idx) {
    const n = parts?.length || 0
    if (n === 0) return ''
    const blanks = Math.max(0, n - 1)
    const iSel = Math.max(0, Math.min(Math.max(0, blanks - 1), Number(idx) || 0))
    const out = []
    for (let i = 0; i < n; i++) {
      out.push(parts[i] || '')
      if (i < n - 1) {
        if (i === iSel) {
          if (w) {
            out.push(w)
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

  function sanitizeWord(raw) {
    return (raw || '')
      .trim()
      .split(' ')[0]
      .replace(/[^a-zA-Z0-9\-_]/g, '')
      .slice(0, 16)
  }

  // passive wallet (no prompting)
  useEffect(() => {
    if (!window?.ethereum) return
    let cancelled = false
    ;(async () => {
      try {
        const accts = await window.ethereum.request?.({ method: 'eth_accounts' })
        if (!cancelled) setAddress(accts?.[0] || null)
      } catch {}
      const onAcct = (accs) => setAddress(accs?.[0] || null)
      window.ethereum.on?.('accountsChanged', onAcct)
      return () => {
        window.ethereum.removeListener?.('accountsChanged', onAcct)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // fetch farcaster flair once we know the address
  useEffect(() => {
    if (!address) return
    ;(async () => {
      try {
        const p = await fetchFarcasterProfile(address)
        setProfile(p || null)
      } catch {}
    })()
  }, [address])

  // featured rounds (read-only)
  useEffect(() => {
    let cancelled = false
    setLoadingFeatured(true)
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider(BASE_RPC)
        const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
        const total = Number(await ct.pool1Count())
        if (total === 0) {
          if (!cancelled) setFeatured([])
          return
        }
        const start = Math.max(1, total - FEATURED_TAKE + 1)
        const rows = []
        for (let id = total; id >= start; id--) {
          const info = await ct.getPool1Info(BigInt(id))
          const name = info[0]
          const theme = info[1]
          const parts = info[2]
          const feeBase = info[3]
          const deadline = Number(info[4])
          const creator = info[5]
          const participants = info[6] || []
          const poolBalance = info[9]

          let creatorPreview = ''
          try {
            const sub = await ct.getPool1Submission(BigInt(id), creator)
            const stored = sub[1]
            creatorPreview = buildPreviewSingle(parts, stored, 0)
          } catch {}

          rows.push({
            id,
            name: name || `Round #${id}`,
            theme,
            parts,
            preview: creatorPreview || buildPreviewSingle(parts, '', 0),
            entrants: participants.length,
            poolEth: Number(ethers.formatEther(poolBalance || 0n)),
            deadline
          })
        }
        if (!cancelled) setFeatured(rows)
      } catch (e) {
        console.error('Featured fetch failed', e)
        if (!cancelled) setFeatured([])
      } finally {
        if (!cancelled) setLoadingFeatured(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const preview = useMemo(
    () => buildPreviewSingle(tpl.parts, sanitizeWord(word), blankIndex),
    [tpl.parts, word, blankIndex]
  )

  async function handleCreateRound() {
    const cleanWord = sanitizeWord(word)
    if (!cleanWord) {
      setStatus('Enter one word (letters/numbers/_/-), up to 16 chars.')
      log('Invalid word')
      return
    }
    if ((tpl?.parts?.length || 0) !== (tpl?.blanks || 0) + 1) {
      setStatus('Template error: parts must equal blanks + 1.')
      log('Template mismatch')
      return
    }
    if (!window?.ethereum) {
      setStatus('No wallet detected.')
      return
    }

    try {
      setBusy(true)
      setStatus('')
      log('Connecting wallet...')
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const net = await provider.getNetwork()
      if (net?.chainId !== 8453n) {
        throw new Error('Please switch to Base network')
      }

      const signer = await provider.getSigner()
      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)

      const feeBase = ethers.parseUnits(String(feeEth), 18) // ETH on Base
      const value = feeBase // exact value; contract skims 0.5% internally

      const parts = tpl.parts.map((p) => p.trim())
      const name = (roundName || 'Untitled').slice(0, 48)
      const theme = selectedCategory.name
      const username = (profile?.username || 'anon').slice(0, 32)
      const durationSecs = BigInt(duration * 86400)
      const idx = Number(blankIndex) | 0

      log(`Creating round "${name}"...`)

      // Preflight for revert reasons
      await ct.createPool1.staticCall(
        name,
        theme,
        parts,
        cleanWord,
        username,
        feeBase,
        durationSecs,
        idx,
        { value }
      )

      // Real tx
      const tx = await ct.createPool1(
        name,
        theme,
        parts,
        cleanWord,
        username,
        feeBase,
        durationSecs,
        idx,
        { value }
      )
      const rc = await tx.wait()

      // Try to grab id from event; fallback to counter
      let newId = ''
      try {
        const evt = rc.logs?.find((l) => l.fragment?.name === 'Pool1Created')
        if (evt?.args?.id) newId = evt.args.id.toString()
      } catch {}
      if (!newId) {
        const rp = new ethers.JsonRpcProvider(BASE_RPC)
        const reader = new ethers.Contract(CONTRACT_ADDRESS, abi, rp)
        newId = String(await reader.pool1Count())
      }

      setRoundId(newId)
      setShowConfetti(true)
      log(`Round #${newId} created.`)
      setStatus('Success!')
    } catch (err) {
      console.error(err)
      const msg = extractError(err)
      setStatus(msg)
      log(`Create failed: ${msg}`)
    } finally {
      setBusy(false)
      setTimeout(() => setShowConfetti(false), 1800)
    }
  }

  const origin = absoluteUrl('/')
  const roundUrl = roundId ? absoluteUrl(`/round/${roundId}`) : origin
  const shareText = roundId
    ? `I just created a MadFill round! Join Round #${roundId}.`
    : `Play MadFill on Base.`

  const blankPill = (active) =>
    [
      'inline-flex items-center justify-center px-2 h-7 text-center border-b-2 font-bold cursor-pointer mx-1 rounded',
      active
        ? 'border-yellow-300 text-yellow-200 bg-yellow-300/10'
        : 'border-slate-400 text-slate-200 bg-slate-700/40'
    ].join(' ')

  const seoTitle = 'MadFill — Create or Join a Round'
  const seoDesc = 'MadFill on Base. Fill the blank, vote, and win the pool.'
  const ogImage = buildOgUrl({ screen: 'home', title: 'MadFill' })

  return (
    <Layout>
      {/* Farcaster Mini App hint + canonical/icon for clients */}
      <Head>
        <meta name="fc:frame" content="vNext" />
        <link rel="icon" href={absoluteUrl('/favicon.ico')} />
        <link rel="canonical" href={origin} />
      </Head>

      <SEO
        title={seoTitle}
        description={seoDesc}
        url={origin}
        image={ogImage}
      />

      {showConfetti && <Confetti width={width} height={height} />}

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 text-white">
        {/* Hero (wallet lives in Layout header) */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-700 via-fuchsia-700 to-cyan-700 p-6 md:p-8 shadow-xl ring-1 ring-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">MadFill</h1>
              <p className="text-indigo-100 mt-2 max-w-2xl">
                Fill the blank. Make it funny. Win the pot. Create rounds, enter with one word,
                and let the community decide the best punchline.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/active" className="underline text-white/90 text-sm">
                View Active Rounds
              </Link>
            </div>
          </div>
        </div>

        {/* Create Round */}
        <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
          <CardHeader className="border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Create a new round</h2>
              {profile?.username && (
                <div className="text-xs text-slate-300">Hi @{profile.username}</div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {status && (
              <div className="rounded-lg bg-slate-800/70 border border-slate-700 p-2 text-sm">
                {status}
              </div>
            )}

            {/* Name + Category/Template */}
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300">
                Round name (optional)
                <input
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value.slice(0, 48))}
                  placeholder="My spicy round"
                  className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  disabled={busy}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-slate-300">
                  Category
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    value={catIdx}
                    onChange={(e) => {
                      setCatIdx(Number(e.target.value))
                      setTplIdx(0)
                      setBlankIndex(0)
                    }}
                    disabled={busy}
                  >
                    {categories.map((c, i) => (
                      <option key={i} value={i}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-slate-300">
                  Template
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    value={tplIdx}
                    onChange={(e) => {
                      setTplIdx(Number(e.target.value))
                      setBlankIndex(0)
                    }}
                    disabled={busy}
                  >
                    {selectedCategory.templates.map((t, i) => (
                      <option key={i} value={i}>{t.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Preview with blank picker */}
            <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4">
              <div className="text-slate-300 text-sm mb-2">Card preview</div>
              <div className="text-base leading-relaxed">
                {tpl.parts.map((p, i) => (
                  <span key={i}>
                    {p}
                    {i < tpl.parts.length - 1 && (
                      <span
                        role="button"
                        className={blankPill(i === Number(blankIndex))}
                        onClick={() => setBlankIndex(i)}
                        title={`Insert into blank #${i + 1}`}
                      >
                        {i === Number(blankIndex) ? (sanitizeWord(word) || '____') : '____'}
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Click a blank to choose where your word goes.
              </div>
              <div className="mt-3 text-xs italic opacity-80">{preview}</div>
            </div>

            {/* Your word */}
            <label className="block text-sm text-slate-300">
              Your word (one word, letters/numbers/_/-, max 16 chars)
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onBlur={() => setWord((w) => sanitizeWord(w))}
                placeholder="neon"
                className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                disabled={busy}
              />
            </label>

            {/* Fee + Duration */}
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300">
                Duration
                <select
                  className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  disabled={busy}
                >
                  {durations.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-400 mt-1">
                  How long entries are open.
                </div>
              </label>

              <label className="block text-sm text-slate-300">
                Entry fee (ETH on Base)
                <input
                  type="range"
                  min="0.001"
                  max="0.1"
                  step="0.001"
                  value={feeEth}
                  onChange={(e) => setFeeEth(Number(e.target.value))}
                  className="mt-1 w-full"
                  disabled={busy}
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700 text-xs">
                    {feeEth.toFixed(3)} ETH
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Each entrant pays this amount to join your round.
                  </span>
                </div>
              </label>
            </div>

            {/* Submit */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleCreateRound}
                disabled={busy || !word}
                className="bg-indigo-600 hover:bg-indigo-500"
              >
                Create round and submit
              </Button>
              {roundId && (
                <Link href={`/round/${roundId}`} className="underline text-indigo-300 text-sm">
                  View your round
                </Link>
              )}
            </div>

            {/* Share */}
            <div className="pt-2">
              <ShareBar url={roundUrl} text={shareText} embedUrl={roundUrl} />
            </div>

            {/* Logs */}
            {logs.length > 0 && (
              <div
                className="text-green-200 text-xs mt-4 max-h-40 overflow-y-auto p-2 bg-black/40 border border-green-400 rounded"
                ref={loggerRef}
              >
                {logs.map((m, i) => <div key={i}>→ {m}</div>)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Featured */}
        <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
          <CardHeader className="border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Featured rounds</h2>
              <Link href="/active" className="underline text-indigo-300 text-sm">
                View all active
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {loadingFeatured ? (
              <div className="rounded-xl bg-slate-900/70 p-6 animate-pulse text-slate-300">
                Loading featured…
              </div>
            ) : featured.length === 0 ? (
              <div className="text-slate-300">No rounds yet. Be the first to create one!</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {featured.map((r) => {
                  const rUrl = absoluteUrl(`/round/${r.id}`)
                  const shareTxt = `Play MadFill Round #${r.id}!`
                  return (
                    <div key={r.id} className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">#{r.id} — {r.name}</div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700">
                          {r.theme || 'General'}
                        </span>
                      </div>
                      <div className="text-sm italic leading-relaxed line-clamp-4">
                        {r.preview}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <span className="px-2 py-1 rounded bg-slate-900/60 border border-slate-700">
                          Entrants: {r.entrants}
                        </span>
                        <span className="px-2 py-1 rounded bg-slate-900/60 border border-slate-700">
                          Pool: {r.poolEth.toFixed(4)} ETH
                        </span>
                        <span className="px-2 py-1 rounded bg-slate-900/60 border border-slate-700">
                          Ends: {new Date(r.deadline * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <Link href={`/round/${r.id}`} className="underline text-indigo-300 text-sm">
                          Open
                        </Link>
                        <ShareBar url={rUrl} text={shareTxt} embedUrl={rUrl} small />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fees, explained */}
        <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
          <CardHeader className="border-b border-slate-700 bg-slate-800/50">
            <h2 className="text-xl font-bold">How fees work</h2>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-sm">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-800/70 p-4 border border-slate-700">
                <div className="text-2xl">🎟️</div>
                <div className="font-semibold mt-1">Entry fee</div>
                <div className="text-slate-300 mt-1">
                  You set the entry fee when creating the round. Every entrant pays this to join.
                </div>
              </div>
              <div className="rounded-lg bg-slate-800/70 p-4 border border-slate-700">
                <div className="text-2xl">🏆</div>
                <div className="font-semibold mt-1">Prize pool</div>
                <div className="text-slate-300 mt-1">
                  99.5% of each entry goes into the pool. Winner takes all when the round ends.
                </div>
              </div>
              <div className="rounded-lg bg-slate-800/70 p-4 border border-slate-700">
                <div className="text-2xl">⚙️</div>
                <div className="font-semibold mt-1">Protocol fee</div>
                <div className="text-sm">
                  A tiny 0.5% keeps the lights on
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              All amounts are in ETH on Base. No slippage “buffer” is added — the contract takes its fee from what you send.
            </div>
          </CardContent>
        </Card>

        <Footer />
      </main>
    </Layout>
  )
}
