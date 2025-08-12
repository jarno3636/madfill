// pages/index.jsx
'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryV3_ABI.json'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardContent } from '../components/ui/card'
import { categories, durations } from '../data/templates'
import ShareBar from '../components/ShareBar'
import Layout from '@/components/Layout'
import { fetchFarcasterProfile } from '../lib/neynar'
import SEO from '../components/SEO'
import { absoluteUrl, buildOgUrl } from '../lib/seo'
import { useMiniAppReady } from '../hooks/useMiniAppReady'

/** ---- Chain + contract ---- */
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // FillInStoryV3 on Base

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID = 8453n
const BASE_CHAIN_ID_HEX = '0x2105'

/** ---- Helpers ---- */
const FEATURED_TAKE = 9

const extractError = (e) =>
  e?.shortMessage ||
  e?.reason ||
  e?.error?.message ||
  e?.data?.message ||
  e?.message ||
  (typeof e === 'string' ? e : JSON.stringify(e))

const needsSpaceBefore = (str) => {
  if (!str) return false
  const ch = str[0]
  return !(/\s/.test(ch) || /[.,!?;:)"'\\\]]/.test(ch))
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

/** Prefer Mini App provider if present (Warpcast), else window.ethereum */
function useEip1193() {
  const miniProvRef = useRef(null)

  const getProvider = useCallback(async () => {
    // 1) injected (web)
    if (typeof window !== 'undefined' && window.ethereum) return window.ethereum
    // 2) Farcaster Mini wallet
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

  return getProvider
}

export default function Home() {
  useMiniAppReady()

  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState([])
  const loggerRef = useRef(null)

  const [address, setAddress] = useState(null)
  const [roundId, setRoundId] = useState('')
  const [roundName, setRoundName] = useState('')
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [blankIndex, setBlankIndex] = useState(0)
  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(durations[0].value) // days
  const [feeEth, setFeeEth] = useState(0.01) // UI value, sent 1:1 as feeBase
  const [busy, setBusy] = useState(false)
  const [profile, setProfile] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [featured, setFeatured] = useState([])
  const [loadingFeatured, setLoadingFeatured] = useState(true)

  const { width, height } = useWindowSize()
  const getEip1193 = useEip1193()

  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  const log = (msg) => {
    setLogs((prev) => [...prev, msg])
    setTimeout(() => {
      if (loggerRef.current) loggerRef.current.scrollTop = loggerRef.current.scrollHeight
    }, 30)
  }

  /** ---- wallet observe (passive) ---- */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const eip = await getEip1193()
      if (!eip) return
      try {
        const accts = await eip.request?.({ method: 'eth_accounts' })
        if (!cancelled) setAddress(accts?.[0] || null)
      } catch {}
      // account changes (injected)
      if (eip && eip.on && eip.removeListener) {
        const onAcct = (accs) => setAddress(accs?.[0] || null)
        eip.on('accountsChanged', onAcct)
        return () => eip.removeListener('accountsChanged', onAcct)
      }
    })()
    return () => { cancelled = true }
  }, [getEip1193])

  /** ---- Farcaster profile ---- */
  useEffect(() => {
    if (!address) return
    ;(async () => {
      try {
        const p = await fetchFarcasterProfile(address)
        setProfile(p || null)
      } catch {}
    })()
  }, [address])

  /** ---- Featured (read-only) ---- */
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
            deadline,
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

  /** ---- Preview ---- */
  const preview = useMemo(
    () => buildPreviewSingle(tpl.parts, sanitizeWord(word), blankIndex),
    [tpl.parts, word, blankIndex]
  )

  /** ---- Chain switch ---- */
  const switchToBase = useCallback(async () => {
    const eip = await getEip1193()
    if (!eip) throw new Error('No wallet detected')
    try {
      await eip.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      })
    } catch (e) {
      if (e?.code === 4902) {
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
      } else {
        throw e
      }
    }
  }, [getEip1193])

  /** ---- Create round (feeBase‑accurate, better errors) ---- */
  async function handleCreateRound() {
    const cleanWord = sanitizeWord(word)
    if (!cleanWord) {
      setStatus('Enter one word (letters/numbers/_/-), up to 16 chars.')
      log('Invalid word')
      return
    }

    // Parts must equal blanks + 1 (UI templates should satisfy this, but keep guard)
    if ((tpl?.parts?.length || 0) !== (tpl?.blanks || 0) + 1) {
      setStatus('Template error: parts must equal blanks + 1.')
      log('Template mismatch')
      return
    }

    // Fee guard (contract commonly requires > 0 and sane lower bound)
    if (!(feeEth > 0)) {
      setStatus('Entry fee must be greater than 0.')
      return
    }
    if (feeEth < 0.001) {
      setStatus('Minimum entry fee is 0.001 ETH.')
      return
    }

    // Duration guard — if your contract enforces bounds, tweak here
    if (duration <= 0) {
      setStatus('Duration must be at least 1 day.')
      return
    }

    try {
      setBusy(true)
      setStatus('')
      log('Connecting wallet…')

      const eip = await getEip1193()
      if (!eip) throw new Error('No wallet detected')

      const provider = new ethers.BrowserProvider(eip)
      await eip.request?.({ method: 'eth_requestAccounts' })
      let signer = await provider.getSigner()

      const net = await provider.getNetwork()
      if (net?.chainId !== BASE_CHAIN_ID) {
        setStatus('Switching to Base…')
        await switchToBase()
        const p2 = new ethers.BrowserProvider(await getEip1193())
        signer = await p2.getSigner()
      }

      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)

      // 🔒 feeBase: exact on-chain value (no buffer). UI fee is ETH -> Wei.
      const feeBase = ethers.parseUnits(String(feeEth), 18)
      const value = feeBase
      const parts = tpl.parts.map((p) => p.trim())
      const name = (roundName || 'Untitled').slice(0, 48)
      const theme = selectedCategory.name
      const username = (profile?.username || 'anon').slice(0, 32)
      const durationSecs = BigInt(duration * 86400)
      const idx = Number(blankIndex) | 0

      // Preflight to surface precise revert reasons
      log(`Creating round "${name}" (preflight)…`)
      try {
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
      } catch (err) {
        const msg = extractError(err)
        setStatus(`Preflight failed: ${msg}`)
        log(`Preflight failed: ${msg}`)
        setBusy(false)
        return
      }

      log('Sending transaction…')
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

      setStatus('Waiting for confirmation…')
      const rc = await tx.wait()

      let newId = ''
      try {
        // ethers v6 log parsing (if ABI includes event fragment names)
        const evt = rc.logs?.find((l) => l.fragment?.name === 'Pool1Created')
        if (evt?.args?.id) newId = evt.args.id.toString()
      } catch {}

      if (!newId) {
        // Fallback to reading count after tx mines
        const rp = new ethers.JsonRpcProvider(BASE_RPC)
        const reader = new ethers.Contract(CONTRACT_ADDRESS, abi, rp)
        newId = String(await reader.pool1Count())
      }

      setRoundId(newId)
      setShowConfetti(true)
      log(`Round #${newId} created.`)
      setStatus('✅ Success!')
      setTimeout(() => setShowConfetti(false), 1800)
    } catch (err) {
      console.error(err)
      const msg = extractError(err)
      setStatus(`❌ ${msg}`)
      log(`Create failed: ${msg}`)
      setShowConfetti(false)
    } finally {
      setBusy(false)
    }
  }

  /** ---- SEO ---- */
  const origin = absoluteUrl('/')
  const roundUrl = roundId ? absoluteUrl(`/round/${roundId}`) : origin
  const shareText = roundId
    ? `I just created a MadFill round! Join Round #${roundId}.`
    : `Play MadFill on Base.`
  const seoTitle = 'MadFill — Create or Join a Round'
  const seoDesc = 'MadFill on Base. Fill the blank, vote, and win the pool.'
  const ogImage = buildOgUrl({ screen: 'home', title: 'MadFill' })

  return (
    <>
      <Head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="Open MadFill" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={origin} />
        <link rel="canonical" href={origin} />
      </Head>

      <SEO title={seoTitle} description={seoDesc} url={origin} image={ogImage} />

      {showConfetti && <Confetti width={width} height={height} />}

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 text-white">
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
              <div className={`rounded-lg p-2 text-sm border ${
                status.startsWith('✅')
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-200'
                  : status.startsWith('❌')
                  ? 'bg-rose-500/10 border-rose-500 text-rose-200'
                  : 'bg-slate-800/70 border-slate-700 text-slate-200'
              }`}>
                {status}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300">
                Round name (optional)
                <input
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value.slice(0, 48))}
                  placeholder="My spicy round"
                  className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white focus:border-yellow-500 focus:outline-none"
                />
              </label>

              <label className="block text-sm text-slate-300">
                Entry fee (ETH on Base)
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={feeEth}
                  onChange={(e) => setFeeEth(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white focus:border-yellow-500 focus:outline-none"
                />
              </label>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-slate-300">Category</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat, i) => (
                  <button
                    key={cat.name}
                    onClick={() => { setCatIdx(i); setTplIdx(0) }}
                    className={`px-3 py-2 rounded text-sm font-medium ${
                      i === catIdx
                        ? 'bg-yellow-500 text-black'
                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-slate-300">Template</label>
              <div className="space-y-2">
                {selectedCategory.templates.map((template, i) => (
                  <button
                    key={i}
                    onClick={() => setTplIdx(i)}
                    className={`w-full p-3 text-left rounded border ${
                      i === tplIdx
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-slate-600 bg-slate-800/50 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-sm">
                      {buildPreviewSingle(template.parts, '', 0)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-slate-300">Your word</label>
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="Enter your word..."
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white focus:border-yellow-500 focus:outline-none"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm text-slate-300">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white focus:border-yellow-500 focus:outline-none"
              >
                {durations.map((dur) => (
                  <option key={dur.value} value={dur.value}>{dur.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-slate-300">Preview</label>
              <div className="p-4 bg-slate-800/70 rounded border border-slate-700">
                <div className="text-white font-medium">
                  {preview || 'Enter a word to see preview...'}
                </div>
              </div>
            </div>

            <Button onClick={handleCreateRound} disabled={busy || !word.trim()} className="w-full">
              {busy ? 'Creating…' : 'Create Round'}
            </Button>

            {roundId && (
              <div className="mt-4 p-4 bg-green-900/50 border border-green-700 rounded">
                <div className="text-green-100 font-medium mb-2">
                  Round #{roundId} created successfully!
                </div>
                <ShareBar url={roundUrl} text={shareText} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Rounds */}
        <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
          <CardHeader className="border-b border-slate-700 bg-slate-800/50">
            <h2 className="text-xl font-bold">Recent Rounds</h2>
          </CardHeader>
          <CardContent className="p-5">
            {loadingFeatured ? (
              <div className="text-center py-8 text-slate-400">Loading recent rounds…</div>
            ) : featured.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No rounds yet. Be the first to create one!</div>
            ) : (
              <div className="grid gap-4">
                {featured.map((round) => (
                  <div
                    key={round.id}
                    className="p-4 bg-slate-800/50 rounded border border-slate-600 hover:border-slate-500 transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium">{round.name}</h3>
                      <span className="text-xs text-slate-400">#{round.id}</span>
                    </div>
                    <div className="text-sm text-slate-300 mb-2">{round.preview}</div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{round.entrants} entries</span>
                      <span>{round.poolEth.toFixed(4)} ETH pool</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
