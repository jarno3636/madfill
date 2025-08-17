// pages/challenge.jsx
'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'
import Layout from '@/components/Layout'
import SEO from '@/components/SEO'
import ShareBar from '@/components/ShareBar'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryV3_ABI.json'
import { fetchFarcasterProfile } from '@/lib/neynar'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import { useTx } from '@/components/TxProvider' // ✅ updated path
import dynamic from 'next/dynamic'

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

// Env
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID_HEX = '0x2105' // 8453

// Defaults
const DEFAULT_DURATION_SECONDS = 3 * 24 * 60 * 60
const DEFAULT_FEE_ETH = 0.002

export default function ChallengePage() {
  useMiniAppReady()

  // -------- from TxProvider (wallet+network+tx helpers) --------
  const {
    address,
    isOnBase,
    isWarpcast,
    connect,
    switchToBase, // will no-op inside Warpcast per provider logic
    createPool2,
  } = useTx()

  // round + template data
  const [roundId, setRoundId] = useState('')
  const [parts, setParts] = useState([])
  const [originalWordRaw, setOriginalWordRaw] = useState('') // "idx::word"
  const [creatorAddr, setCreatorAddr] = useState('')
  const [roundName, setRoundName] = useState('')

  // challenger inputs
  const [username, setUsername] = useState('')
  const [blankIndex, setBlankIndex] = useState(0)
  const [word, setWord] = useState('')
  const [feeEth, setFeeEth] = useState(DEFAULT_FEE_ETH)
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SECONDS)

  // ui state
  const [loadingRound, setLoadingRound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)

  const { width, height } = useWindowSize()
  const tickRef = useRef(null)
  const router = useRouter()

  // ---------- utils ----------
  const needsSpaceBefore = (str) =>
    !(/\s/.test(str?.[0]) || /[.,!?;:)"'\]]/.test(str?.[0]))

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

  function buildPreviewSingle(_parts, w, idx) {
    const n = _parts?.length || 0
    if (n === 0) return ''
    const blanks = Math.max(0, n - 1)
    const safeIdx = Math.max(0, Math.min(Math.max(0, blanks - 1), Number(idx) || 0))
    const out = []
    for (let i = 0; i < n; i++) {
      out.push(_parts[i] || '')
      if (i < n - 1) {
        if (i === safeIdx) {
          if (w) {
            out.push(w)
            if (needsSpaceBefore(_parts[i + 1] || '')) out.push(' ')
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

  function buildPreviewFromStored(_parts, stored) {
    const { index, word } = parseStoredWord(stored)
    return buildPreviewSingle(_parts, word, index)
  }

  const sanitizeWord = (raw) =>
    (raw || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')[0]
      .replace(/[^a-zA-Z0-9\-_]/g, '')
      .slice(0, 16)

  const wordError = useMemo(() => {
    if (!word) return 'Enter one word (max 16 chars).'
    if (word.length > 16) return 'Max 16 characters.'
    if (!/^[a-zA-Z0-9\-_]+$/.test(word)) return 'Only letters, numbers, hyphen, underscore.'
    return ''
  }, [word])

  const originalPreview = useMemo(
    () => buildPreviewFromStored(parts, originalWordRaw),
    [parts, originalWordRaw]
  )
  const challengerPreview = useMemo(
    () => buildPreviewSingle(parts, word, blankIndex),
    [parts, word, blankIndex]
  )

  // ---------- ticks / UX ----------
  useEffect(() => {
    tickRef.current = setInterval(() => setStatus((s) => (s ? s : '')), 1200)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  // ---------- load target round info ----------
  useEffect(() => {
    if (!roundId || !/^\d+$/.test(String(roundId))) {
      setParts([])
      setOriginalWordRaw('')
      setCreatorAddr('')
      setRoundName('')
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setLoadingRound(true)
    setStatus('')

    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider(BASE_RPC)
        const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
        const info = await ct.getPool1Info(BigInt(roundId))
        if (cancelled || controller.signal.aborted) return

        const name = info.name_ ?? info[0]
        const _parts = info.parts_ ?? info[2]
        const creator = info.creator_ ?? info[5]

        const sub = await ct.getPool1Submission(BigInt(roundId), creator)
        if (cancelled || controller.signal.aborted) return
        const origWordRaw = sub.word_ ?? sub[1] // "idx::word"

        setParts(Array.isArray(_parts) ? _parts : [])
        setCreatorAddr(creator)
        setOriginalWordRaw(origWordRaw || '')
        setRoundName(name || `Round #${roundId}`)

        const parsed = parseStoredWord(origWordRaw || '')
        setBlankIndex(parsed.index || 0)
      } catch (err) {
        console.warn('Failed to load round:', err)
        if (!cancelled) {
          setParts([])
          setOriginalWordRaw('')
          setCreatorAddr('')
          setRoundName('')
          setStatus('Could not fetch round. Check the Round ID.')
        }
      } finally {
        if (!cancelled) setLoadingRound(false)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [roundId])

  // Clamp blank index whenever parts change
  useEffect(() => {
    if (!parts?.length) return
    const blanks = Math.max(0, parts.length - 1)
    setBlankIndex((i) =>
      Math.max(0, Math.min(Math.max(0, blanks - 1), Number(i) || 0))
    )
  }, [parts])

  // ---------- submit (Pool2 via TxProvider) ----------
  async function handleSubmit() {
    try {
      if (!address) {
        await connect()
      }
      if (!roundId || !/^\d+$/.test(String(roundId))) throw new Error('Invalid Round ID')
      if (!parts.length) throw new Error('Round has no template loaded yet')

      const cleanWord = sanitizeWord(word)
      if (!cleanWord || wordError) throw new Error(wordError || 'Invalid word')

      setBusy(true)
      setStatus('Submitting your challenger…')

      // encode blank index into word string for onchain storage (ABI has no blankIndex)
      const encodedWord = `${blankIndex}::${cleanWord}`
      const safeFee = Number.isFinite(feeEth) && feeEth >= 0 ? feeEth : DEFAULT_FEE_ETH
      const feeBaseWei = ethers.parseUnits(String(safeFee), 18)
      const durationSecs = Number.isFinite(durationSec) && durationSec > 0
        ? durationSec
        : DEFAULT_DURATION_SECONDS

      await createPool2({
        pool1Id: BigInt(roundId),
        challengerWord: encodedWord,
        challengerUsername: (username || '').slice(0, 32),
        feeBaseWei,
        durationSecs: BigInt(durationSecs),
      })

      setStatus(`Challenger submitted to Round #${roundId}`)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2200)
      setTimeout(() => router.push('/vote'), 1400)
    } catch (err) {
      console.error(err)
      setStatus(String(err?.shortMessage || err?.message || 'Submission failed'))
    } finally {
      setBusy(false)
    }
  }

  // ---------- SEO / Mini App ----------
  const pageUrl = absoluteUrl('/challenge')
  const ogImage = buildOgUrl({ screen: 'challenge', title: 'Submit a Challenger' })

  return (
    <Layout>
      {/* Farcaster Mini App / Frame meta */}
      <Head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="Open Challenge" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
      </Head>

      {/* Standard SEO */}
      <SEO
        title="Submit a Challenger — MadFill"
        description="Think you can out-funny the Original? Drop your one-word zinger and start a head-to-head vote on Base."
        url={pageUrl}
        image={ogImage}
        type="website"
        twitterCard="summary_large_image"
      />

      {showConfetti && <Confetti width={width} height={height} />}

      <main className="max-w-5xl mx-auto p-4 md:p-6 text-white">
        {/* Hero */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-6 md:p-8 mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-fuchsia-300 via-amber-300 to-cyan-300 bg-clip-text text-transparent">
            😆 Submit a Challenger Card
          </h1>
          <p className="mt-2 text-slate-300 max-w-3xl">
            Think you can out-funny the Original? Pick the blank, drop your one-word zinger, and start a head-to-head showdown.
          </p>
        </div>

        {/* Form */}
        <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
          <CardHeader className="bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
            <div className="font-bold">Challenger Form</div>
            {!isOnBase && (
              <Button
                onClick={() => !isWarpcast && switchToBase()}
                disabled={isWarpcast}
                className="bg-cyan-700 hover:bg-cyan-600 text-sm disabled:opacity-60"
                title={isWarpcast ? 'Warpcast wallet handles network internally' : 'Switch to Base'}
              >
                Switch to Base
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* Round ID + username */}
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300">
                Target Round ID
                <input
                  value={roundId}
                  onChange={(e) =>
                    setRoundId(e.target.value.replace(/[^\d]/g, '').slice(0, 10))
                  }
                  placeholder="e.g., 12"
                  className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Your username (optional)
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 32))}
                  placeholder="e.g., frogtown"
                  className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
            </div>

            {/* Template previews */}
            {loadingRound ? (
              <div className="rounded-xl bg-slate-900/70 p-6 animate-pulse text-slate-300">
                Loading round…
              </div>
            ) : parts.length === 0 ? (
              <div className="text-slate-400 text-sm">
                Enter a valid Round ID to load the template.
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4 items-start">
                  <div>
                    <div className="text-sm text-slate-300 mb-1">
                      Original Card{roundName ? ` — ${roundName}` : ''}
                    </div>
                    <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl shadow-md text-sm leading-relaxed">
                      {originalPreview}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-300 mb-1">Your Challenger Card</div>
                    <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl shadow-md text-sm leading-relaxed">
                      {challengerPreview}
                    </div>
                  </div>
                </div>

                {/* Pick Blank */}
                <div>
                  <div className="text-sm text-slate-300 mb-1">Pick a blank</div>
                  <div className="bg-slate-800/60 border border-slate-700 rounded p-3 text-sm">
                    {parts.map((p, i) => (
                      <Fragment key={i}>
                        <span>{p}</span>
                        {i < parts.length - 1 && (
                          <span
                            role="button"
                            className={[
                              'inline-block w-8 text-center border-b-2 font-bold cursor-pointer mx-1',
                              i === Number(blankIndex)
                                ? 'border-yellow-300 text-yellow-200'
                                : 'border-slate-400 text-slate-200'
                            ].join(' ')}
                            onClick={() => setBlankIndex(i)}
                            title={`Insert your word into blank #${i + 1}`}
                          >
                            {i + 1}
                          </span>
                        )}
                      </Fragment>
                    ))}
                  </div>
                </div>

                {/* Word + Fee/Duration */}
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block text-sm text-slate-300">
                    Your word (single word, max 16 chars)
                    <input
                      value={word}
                      onChange={(e) => setWord(e.target.value)}
                      onBlur={() => setWord((w) => w.trim())}
                      placeholder="e.g., neon"
                      className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    {word && wordError && (
                      <div className="text-xs text-amber-300 mt-1">{wordError}</div>
                    )}
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm text-slate-300">
                      Voting fee (ETH)
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={feeEth}
                        onChange={(e) => setFeeEth(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <div className="text-[11px] text-slate-400 mt-1">
                        This becomes the fee for each vote and must be covered in your tx value.
                      </div>
                    </label>
                    <label className="block text-sm text-slate-300">
                      Duration
                      <select
                        className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                        value={durationSec}
                        onChange={(e) => setDurationSec(Number(e.target.value))}
                      >
                        <option value={24 * 60 * 60}>1 day</option>
                        <option value={2 * 24 * 60 * 60}>2 days</option>
                        <option value={3 * 24 * 60 * 60}>3 days</option>
                        <option value={5 * 24 * 60 * 60}>5 days</option>
                        <option value={7 * 24 * 60 * 60}>7 days</option>
                      </select>
                      <div className="text-[11px] text-slate-400 mt-1">How long the vote stays open.</div>
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleSubmit}
                disabled={
                  busy || !roundId || !parts.length || !word || !!wordError
                }
                className="bg-blue-600 hover:bg-blue-500"
                title={!address ? 'Connect your wallet' : 'Submit challenger'}
              >
                {address ? 'Submit Challenger' : 'Connect & Submit'}
              </Button>

              {!address && (
                <Button
                  variant="outline"
                  onClick={connect}
                  className="border-slate-600 text-slate-200"
                >
                  Connect Wallet
                </Button>
              )}

              <Link href="/vote" className="underline text-indigo-300 text-sm">
                View Community Vote
              </Link>
              <span className="text-xs text-slate-400">
                We send a small buffer over fee in the provider to avoid rounding reverts.
              </span>
            </div>

            {status && <div className="text-sm text-yellow-300">{status}</div>}

            {/* ✅ Safe ShareBar after submit */}
            {String(status).toLowerCase().includes('submitted') && (
              <div className="text-sm mt-4">
                <ShareBar
                  url={absoluteUrl('/vote')}
                  title={`🧠 Vote in MadFill Round #${roundId}!`}
                  theme="MadFill"
                  templateName={roundName || `Round #${roundId}`}
                  feeEth={String(feeEth)}
                  durationMins={Math.floor(durationSec / 60)}
                  hashtags={['MadFill', 'Base', 'Farcaster']}
                  embed="/og/cover.png"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  )
}
