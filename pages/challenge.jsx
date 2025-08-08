// pages/challenge.jsx
'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryV3_ABI.json'
import Link from 'next/link'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import { useRouter } from 'next/router'
import { fetchFarcasterProfile } from '@/lib/neynar'

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x6975a550130642E5cb67A87BE25c8134542D5a0a' // FillInStoryV3

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID_HEX = '0x2105' // 8453 Base

// Reasonable defaults; you can tweak these in UI
const DEFAULT_DURATION_SECONDS = 3 * 24 * 60 * 60 // 3 days
const DEFAULT_FEE_ETH = 0.002 // ETH sent as feeBase and msg.value (we add tiny buffer)

export default function ChallengePage() {
  // wallet / chain
  const [address, setAddress] = useState(null)
  const [isOnBase, setIsOnBase] = useState(true)

  // round + template data
  const [roundId, setRoundId] = useState('')
  const [parts, setParts] = useState([]) // fetched from Pool1
  const [originalWordRaw, setOriginalWordRaw] = useState('') // "index::word" or "word"
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

  // utils
  const toEth = (wei) => (wei ? Number(ethers.formatEther(wei)) : 0)
  const fmt = (n, d = 2) => new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n)
  const blanksCount = useMemo(() => Math.max(0, parts.length - 1), [parts])

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
  function buildPreviewSingle(_parts, w, idx) {
    const n = _parts?.length || 0
    if (n === 0) return ''
    const blanks = Math.max(0, n - 1)
    const iSel = Math.max(0, Math.min(Math.max(0, blanks - 1), idx || 0))
    const out = []
    for (let i = 0; i < n; i++) {
      out.push(_parts[i] || '')
      if (i < n - 1) {
        if (i === iSel) {
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

  // wallet + chain
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
    return () => { cancelled = true }
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

  // price ping keeps status alive for countdowns (not used here but nice for UI ticks)
  useEffect(() => {
    tickRef.current = setInterval(() => setStatus((s) => (s ? s : '')), 1200)
    return () => clearInterval(tickRef.current)
  }, [])

  // profile username (optional)
  useEffect(() => {
    if (!address) return
    ;(async () => {
      try {
        const p = await fetchFarcasterProfile(address)
        if (p?.username) setUsername(p.username)
      } catch {}
    })()
  }, [address])

  // load target round info
  useEffect(() => {
    if (!roundId || !/^\d+$/.test(String(roundId))) {
      setParts([])
      setOriginalWordRaw('')
      setCreatorAddr('')
      setRoundName('')
      return
    }
    let cancelled = false
    setLoadingRound(true)
    setStatus('')

    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider(BASE_RPC)
        const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
        // getPool1Info => (name, theme, parts, feeBase, deadline, creator, participants, winner, claimed, poolBalance)
        const info = await ct.getPool1Info(BigInt(roundId))
        const name = info[0]
        const _parts = info[2]
        const creator = info[5]

        // original submission for preview (the round creator's word)
        const sub = await ct.getPool1Submission(BigInt(roundId), creator)
        const origWordRaw = sub[1]

        if (cancelled) return
        setParts(Array.isArray(_parts) ? _parts : [])
        setCreatorAddr(creator)
        setOriginalWordRaw(origWordRaw || '')
        setRoundName(name || `Round #${roundId}`)

        // default challenger blank to original's blank index for a fair apples-apples faceoff
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

    return () => { cancelled = true }
  }, [roundId])

  // validation
  function sanitizeWord(raw) {
    // one token, letters/numbers/hyphen/underscore, 1..16 chars
    const token = (raw || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')[0]
      .replace(/[^a-zA-Z0-9\-_]/g, '')
      .slice(0, 16)
    return token
  }
  const wordError = useMemo(() => {
    if (!word) return 'Enter one word (max 16 chars).'
    if (word.length > 16) return 'Max 16 characters.'
    if (!/^[a-zA-Z0-9\-_]+$/.test(word)) return 'Only letters, numbers, hyphen, underscore.'
    return ''
  }, [word])

  // previews
  const originalPreview = useMemo(() => buildPreviewFromStored(parts, originalWordRaw), [parts, originalWordRaw])
  const challengerPreview = useMemo(() => buildPreviewSingle(parts, word, blankIndex), [parts, word, blankIndex])

  // submit
  async function handleSubmit() {
    try {
      if (!window?.ethereum) throw new Error('No wallet detected')
      if (!roundId || !/^\d+$/.test(String(roundId))) throw new Error('Invalid Round ID')
      if (!parts.length) throw new Error('Round has no template loaded yet')
      const cleanWord = sanitizeWord(word)
      if (!cleanWord || wordError) throw new Error(wordError || 'Invalid word')

      setBusy(true)
      setStatus('Submitting your challenger…')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const net = await provider.getNetwork()
      if (net?.chainId !== 8453n) await switchToBase()

      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)

      // createPool2(uint256 pool1Id, string challengerWord, string challengerUsername, uint256 feeBase, uint256 duration) payable
      const encodedWord = `${blankIndex}::${cleanWord}`
      const feeBase = ethers.parseUnits(String(feeEth || 0), 18) // ETH -> wei
      const duration = BigInt(durationSec || DEFAULT_DURATION_SECONDS)

      // slight buffer on msg.value to avoid rounding reverts
      const value = (feeBase * 1005n) / 1000n

      const tx = await ct.createPool2(
        BigInt(roundId),
        encodedWord,
        username || '',
        feeBase,
        duration,
        { value }
      )

      await tx.wait()
      setStatus(`Challenger submitted to Round #${roundId}`)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2200)
      setTimeout(() => router.push('/vote'), 1400)
    } catch (err) {
      console.error(err)
      setStatus('' + (err?.shortMessage || err?.message || 'Submission failed'))
    } finally {
      setBusy(false)
    }
  }

  // helpers
  const blankChip = (active) =>
    [
      'inline-block w-8 text-center border-b-2 font-bold cursor-pointer mx-1',
      active ? 'border-yellow-300 text-yellow-200' : 'border-slate-400 text-slate-200'
    ].join(' ')

  // share text after success
  const shareText = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://madfill.vercel.app'
    const link = `${origin}/vote`
    return encodeURIComponent(`I just submitted a challenger for Round #${roundId}! Vote here: ${link}`)
  }, [roundId])

  return (
    <Layout>
      <Head><title>Submit a Challenger — MadFill</title></Head>
      {showConfetti && <Confetti width={width} height={height} />}

      <main className="max-w-5xl mx-auto p-4 md:p-6 text-white">
        {/* Hero */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-6 md:p-8 mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-fuchsia-300 via-amber-300 to-cyan-300 bg-clip-text text-transparent">
            😆 Submit a Challenger Card
          </h1>
          <p className="mt-2 text-slate-300 max-w-3xl">
            Think you can out-funny the Original? Pick the blank, drop your one-word zinger, and start a head-to-head showdown.
            Voters choose between the Original card and your Challenger — the winning side splits the prize pool.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Tip: For a fair fight, we default to the same blank index used by the Original card. You can switch if you want.
          </p>
        </div>

        {/* Form */}
        <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
          <CardHeader className="bg-slate-800/60 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div className="font-bold">Challenger Form</div>
              {!isOnBase && (
                <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600 text-sm">
                  Switch to Base
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* Round ID + username */}
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300">
                Target Round ID
                <input
                  value={roundId}
                  onChange={(e) => setRoundId(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
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
              <div className="rounded-xl bg-slate-900/70 p-6 animate-pulse text-slate-300">Loading round…</div>
            ) : parts.length === 0 ? (
              <div className="text-slate-400 text-sm">Enter a valid Round ID to load the template.</div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4 items-start">
                  <div>
                    <div className="text-sm text-slate-300 mb-1">Original Card{roundName ? ` — ${roundName}` : ''}</div>
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
                            className={blankChip(i === Number(blankIndex))}
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

                {/* Word input */}
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
                    {word && wordError && <div className="text-xs text-amber-300 mt-1">{wordError}</div>}
                  </label>

                  {/* Fee + Duration */}
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
                      <div className="text-[11px] text-slate-400 mt-1">
                        How long the vote stays open.
                      </div>
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
                  busy ||
                  !address ||
                  !parts.length ||
                  !roundId ||
                  !word ||
                  !!wordError
                }
                className="bg-blue-600 hover:bg-blue-500"
                title={!address ? 'Connect your wallet' : 'Submit challenger'}
              >
                Submit Challenger
              </Button>
              <Link href="/vote" className="underline text-indigo-300 text-sm">
                View Community Vote
              </Link>
              <span className="text-xs text-slate-400">
                We send a small buffer over fee to avoid rounding reverts.
              </span>
            </div>

            {status && <div className="text-sm text-yellow-300">{status}</div>}

            {status.toLowerCase().includes('submitted') && (
              <div className="text-sm mt-4">
                Share your card:
                <a
                  href={`https://twitter.com/intent/tweet?text=${shareText}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 underline text-blue-400"
                >
                  Share
                </a>
                <span className="mx-2 text-slate-600">|</span>
                <a
                  href={`https://warpcast.com/~/compose?text=${shareText}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-purple-300"
                >
                  Cast
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  )
}
