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

const CONTRACT_ADDRESS = '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // FillInStoryV3
const BASE_RPC = 'https://mainnet.base.org'
const BASE_CHAIN_ID_HEX = '0x2105'
const DEFAULT_DURATION_SECONDS = 3 * 24 * 60 * 60
const DEFAULT_FEE_ETH = 0.002

export default function ChallengePage() {
  const [address, setAddress] = useState(null)
  const [isOnBase, setIsOnBase] = useState(true)
  const [roundId, setRoundId] = useState('')
  const [parts, setParts] = useState([])
  const [originalWordRaw, setOriginalWordRaw] = useState('')
  const [creatorAddr, setCreatorAddr] = useState('')
  const [roundName, setRoundName] = useState('')
  const [username, setUsername] = useState('')
  const [blankIndex, setBlankIndex] = useState(0)
  const [word, setWord] = useState('')
  const [feeEth, setFeeEth] = useState(DEFAULT_FEE_ETH)
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SECONDS)
  const [loadingRound, setLoadingRound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const { width, height } = useWindowSize()
  const tickRef = useRef(null)
  const router = useRouter()

  const parseStoredWord = (stored) => {
    if (!stored) return { index: 0, word: '' }
    const sep = stored.indexOf('::')
    if (sep > -1) {
      const idx = Number.parseInt(stored.slice(0, sep), 10) || 0
      return { index: Math.max(0, Math.min(99, idx)), word: stored.slice(sep + 2) }
    }
    return { index: 0, word: stored }
  }

  const needsSpaceBefore = (str) => !(/\s/.test(str?.[0]) || /[.,!?;:)"'\]]/.test(str?.[0]))

  const buildPreviewSingle = (_parts, w, idx) => {
    const out = []
    for (let i = 0; i < _parts.length; i++) {
      out.push(_parts[i] || '')
      if (i < _parts.length - 1) {
        out.push(i === idx ? (w || '____') : '____')
        if (i === idx && w && needsSpaceBefore(_parts[i + 1])) out.push(' ')
      }
    }
    return out.join('')
  }

  const buildPreviewFromStored = (_parts, stored) => {
    const { index, word } = parseStoredWord(stored)
    return buildPreviewSingle(_parts, word, index)
  }

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

  useEffect(() => {
    tickRef.current = setInterval(() => setStatus((s) => (s ? s : '')), 1200)
    return () => clearInterval(tickRef.current)
  }, [])

  useEffect(() => {
    if (!address) return
    ;(async () => {
      try {
        const p = await fetchFarcasterProfile(address)
        if (p?.username) setUsername(p.username)
      } catch {}
    })()
  }, [address])

  useEffect(() => {
    if (!roundId || !/^\d+$/.test(roundId)) {
      setParts([])
      return
    }
    let cancelled = false
    setLoadingRound(true)
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider(BASE_RPC)
        const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
        const info = await ct.getPool1Info(BigInt(roundId))
        const _parts = info[2]
        const creator = info[5]
        const sub = await ct.getPool1Submission(BigInt(roundId), creator)
        const origWordRaw = sub[1]
        if (cancelled) return
        setParts(Array.isArray(_parts) ? _parts : [])
        setCreatorAddr(creator)
        setOriginalWordRaw(origWordRaw || '')
        setRoundName(info[0] || `Round #${roundId}`)
        const parsed = parseStoredWord(origWordRaw || '')
        setBlankIndex(parsed.index || 0)
      } catch (err) {
        console.warn('Failed to load round:', err)
        if (!cancelled) {
          setParts([])
          setStatus('Could not fetch round. Check the Round ID.')
        }
      } finally {
        if (!cancelled) setLoadingRound(false)
      }
    })()
    return () => { cancelled = true }
  }, [roundId])

  const sanitizeWord = (raw) =>
    (raw || '').replace(/\s+/g, ' ').trim().split(' ')[0].replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 16)

  const wordError = useMemo(() => {
    if (!word) return 'Enter one word (max 16 chars).'
    if (word.length > 16) return 'Max 16 characters.'
    if (!/^[a-zA-Z0-9\-_]+$/.test(word)) return 'Only letters, numbers, hyphen, underscore.'
    return ''
  }, [word])

  const originalPreview = useMemo(() => buildPreviewFromStored(parts, originalWordRaw), [parts, originalWordRaw])
  const challengerPreview = useMemo(() => buildPreviewSingle(parts, word, blankIndex), [parts, word, blankIndex])

  async function handleSubmit() {
    try {
      if (!window?.ethereum) throw new Error('No wallet detected')
      if (!roundId || !/^\d+$/.test(roundId)) throw new Error('Invalid Round ID')
      if (!parts.length) throw new Error('Round not loaded')
      const cleanWord = sanitizeWord(word)
      if (!cleanWord || wordError) throw new Error(wordError || 'Invalid word')

      setBusy(true)
      setStatus('Submitting your challenger…')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const net = await provider.getNetwork()
      if (net?.chainId !== 8453n) await switchToBase()

      const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)
      const encodedWord = `${blankIndex}::${cleanWord}`
      const feeBase = ethers.parseUnits(String(feeEth), 18)
      const duration = BigInt(durationSec)
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
      setStatus(err?.shortMessage || err?.message || 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  const blankChip = (active) =>
    `inline-block w-8 text-center border-b-2 font-bold cursor-pointer mx-1 ${
      active ? 'border-yellow-300 text-yellow-200' : 'border-slate-400 text-slate-200'
    }`

  const shareText = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://madfill.vercel.app'
    return encodeURIComponent(`I just submitted a challenger for Round #${roundId}! Vote here: ${origin}/vote`)
  }, [roundId])

  return (
    <Layout>
      <Head><title>Submit a Challenger — MadFill</title></Head>
      {showConfetti && <Confetti width={width} height={height} />}
      <main className="max-w-5xl mx-auto p-4 md:p-6 text-white">
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-6 md:p-8 mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-fuchsia-300 via-amber-300 to-cyan-300 bg-clip-text text-transparent">
            😆 Submit a Challenger Card
          </h1>
          <p className="mt-2 text-slate-300">Think you can out-funny the Original? Drop your word and battle for the prize pool.</p>
        </div>
        <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
          <CardHeader className="bg-slate-800/60 border-b border-slate-700 flex justify-between">
            <span className="font-bold">Challenger Form</span>
            {!isOnBase && (
              <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600 text-sm">Switch to Base</Button>
            )}
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* Round ID + username */}
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300">
                Target Round ID
                <input value={roundId} onChange={(e) => setRoundId(e.target.value.replace(/[^\d]/g, '').slice(0, 10))} className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2" />
              </label>
              <label className="block text-sm text-slate-300">
                Your username (optional)
                <input value={username} onChange={(e) => setUsername(e.target.value.slice(0, 32))} className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2" />
              </label>
            </div>

            {/* Previews */}
            {loadingRound ? (
              <div className="rounded-xl bg-slate-900/70 p-6 animate-pulse text-slate-300">Loading round…</div>
            ) : parts.length === 0 ? (
              <div className="text-slate-400 text-sm">Enter a valid Round ID to load the template.</div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-300 mb-1">Original Card</div>
                    <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl">{originalPreview}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-300 mb-1">Your Challenger Card</div>
                    <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl">{challengerPreview}</div>
                  </div>
                </div>

                {/* Blank selection */}
                <div className="bg-slate-800/60 border border-slate-700 rounded p-3 text-sm">
                  {parts.map((p, i) => (
                    <Fragment key={i}>
                      <span>{p}</span>
                      {i < parts.length - 1 && (
                        <span role="button" className={blankChip(i === Number(blankIndex))} onClick={() => setBlankIndex(i)}>
                          {i + 1}
                        </span>
                      )}
                    </Fragment>
                  ))}
                </div>

                {/* Word input + Fee */}
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block text-sm text-slate-300">
                    Your word
                    <input value={word} onChange={(e) => setWord(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2" />
                    {word && wordError && <div className="text-xs text-amber-300 mt-1">{wordError}</div>}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm text-slate-300">
                      Fee (ETH)
                      <input type="number" min="0" step="0.0001" value={feeEth} onChange={(e) => setFeeEth(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2" />
                    </label>
                    <label className="block text-sm text-slate-300">
                      Duration
                      <select value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2">
                        <option value={86400}>1 day</option>
                        <option value={172800}>2 days</option>
                        <option value={259200}>3 days</option>
                        <option value={432000}>5 days</option>
                        <option value={604800}>7 days</option>
                      </select>
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={handleSubmit} disabled={busy || !address || !parts.length || !roundId || !word || !!wordError} className="bg-blue-600 hover:bg-blue-500">
                Submit Challenger
              </Button>
              <Link href="/vote" className="underline text-indigo-300 text-sm">View Community Vote</Link>
            </div>
            {status && <div className="text-sm text-yellow-300">{status}</div>}
            {status.toLowerCase().includes('submitted') && (
              <div className="text-sm mt-4">
                Share your card:
                <a href={`https://twitter.com/intent/tweet?text=${shareText}`} target="_blank" className="ml-2 underline text-blue-400">Twitter</a>
                <span className="mx-2 text-slate-600">|</span>
                <a href={`https://warpcast.com/~/compose?text=${shareText}`} target="_blank" className="underline text-purple-300">Warpcast</a>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  )
}
