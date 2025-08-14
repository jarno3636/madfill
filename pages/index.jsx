// pages/index.jsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'

import Layout from '@/components/Layout'
import SEO from '@/components/SEO'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import StyledCard from '@/components/StyledCard'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import { useMiniWallet } from '@/hooks/useMiniWallet'
import { useToast } from '@/components/Toast'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'

// Client-only confetti
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

/* ===============================
   Pools Contract (Pool1/Pool2 ABI)
=================================*/
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID = 8453n
const BASE_CHAIN_ID_HEX = '0x2105'

// Replace with your deployed Pools contract
const POOLS_ADDR =
  process.env.NEXT_PUBLIC_POOLS_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // fallback (update to your Pools)

const POOLS_ABI = [
  // --- minimal reads we might use (optional) ---
  { inputs: [], name: 'FEE_BPS', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'BPS_DENOMINATOR', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },

  // --- writes we need ---
  {
    inputs: [
      { type: 'string', name: 'name' },
      { type: 'string', name: 'theme' },
      { type: 'string[]', name: 'parts' },
      { type: 'string', name: 'word' },
      { type: 'string', name: 'username' },
      { type: 'uint256', name: 'feeBase' },
      { type: 'uint256', name: 'duration' },
      { type: 'uint8', name: 'blankIndex' }
    ],
    name: 'createPool1',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  }
]

/* ===============================
   Helpers & UI Data
=================================*/
const bytes = (s) => new TextEncoder().encode(String(s || '')).length
const sanitizeOneWord = (raw) =>
  String(raw || '')
    .trim()
    .split(' ')[0]
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    .slice(0, 16)

const PROMPT_STARTERS = [
  'My day started with [BLANK], then I found a [BLANK] under the couch.',
  'In space, no one can hear your [BLANK], but everyone sees your [BLANK].',
  'The secret ingredient is always [BLANK], served with a side of [BLANK].',
  'When I opened the door, a [BLANK] yelled “[BLANK]!” from the hallway.',
  'Future me only travels for [BLANK] and exceptional [BLANK].',
  'The prophecy spoke of [BLANK] and the legendary [BLANK].'
]

const BG_CHOICES = [
  { key: 'indigoNebula', label: 'Indigo Nebula', cls: 'from-indigo-900 via-purple-800 to-slate-900' },
  { key: 'candy',        label: 'Candy',         cls: 'from-pink-600 via-fuchsia-600 to-purple-700' },
  { key: 'tealSunset',   label: 'Teal Sunset',   cls: 'from-teal-600 via-cyan-700 to-indigo-800' },
  { key: 'magma',        label: 'Magma',         cls: 'from-orange-600 via-rose-600 to-fuchsia-700' },
  { key: 'forest',       label: 'Forest',        cls: 'from-emerald-700 via-teal-700 to-slate-900' },
]

// Convert a story with [BLANK] into parts[] (keeps blanks)
const storyToPartsKeepBlanks = (story) => {
  const chunks = String(story || '').split(/\[BLANK\]/g)
  if (chunks.length === 0) return ['']
  return chunks // parts = text segments; blanks exist between parts
}

/* ===============================
   Index (Home) — Create Pool1
=================================*/
function IndexPage() {
  useMiniAppReady()
  const { addToast } = useToast()
  const { address, isConnected, connect } = useMiniWallet()
  const { width, height } = useWindowSize()

  // Chain state
  const [isOnBase, setIsOnBase] = useState(true)

  // UI
  const [showConfetti, setShowConfetti] = useState(false)
  const [loading, setLoading] = useState(false)

  // Round meta
  const [title, setTitle] = useState('')
  const [theme, setTheme] = useState('')
  const [username, setUsername] = useState('') // creator display name (string)
  const [bgKey, setBgKey] = useState(BG_CHOICES[0].key)

  // Story
  const storyRef = useRef(null)
  const [story, setStory] = useState(PROMPT_STARTERS[0])

  // Entry fee (feeBase)
  const [feeEth, setFeeEth] = useState('0.0005') // editable (string)
  const feeWei = useMemo(() => {
    try { return ethers.parseEther((feeEth || '0').trim()) } catch { return 0n }
  }, [feeEth])

  // Duration minutes
  const [durationMins, setDurationMins] = useState(60) // default 60 mins
  const durationSecs = useMemo(() => BigInt(Math.max(60, Number(durationMins) | 0) * 60), [durationMins])

  // Creator’s own entry
  const [creatorWord, setCreatorWord] = useState('')
  const blanksCount = Math.max(0, story.split(/\[BLANK\]/g).length - 1)
  const [blankIndex, setBlankIndex] = useState(0)

  // Optional USD
  const [usd, setUsd] = useState(null)

  // Base chain observe
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const prov = (typeof window !== 'undefined' && window.ethereum) || null
        if (prov) {
          const provider = new ethers.BrowserProvider(prov)
          try {
            const net = await provider.getNetwork()
            if (!cancelled) setIsOnBase(net?.chainId === BASE_CHAIN_ID)
          } catch {
            if (!cancelled) setIsOnBase(true)
          }
          const onChain = () => location.reload()
          prov.on?.('chainChanged', onChain)
          return () => prov.removeListener?.('chainChanged', onChain)
        } else if (!cancelled) {
          setIsOnBase(true)
        }
      } catch {
        if (!cancelled) setIsOnBase(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const switchToBase = useCallback(async () => {
    const prov = (typeof window !== 'undefined' && window.ethereum) || null
    if (!prov) {
      addToast({ type: 'error', title: 'No Wallet', message: 'No wallet provider found.' })
      return
    }
    try {
      await prov.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID_HEX }] })
      setIsOnBase(true)
    } catch (e) {
      if (e?.code === 4902) {
        try {
          await prov.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: BASE_CHAIN_ID_HEX,
              chainName: 'Base',
              rpcUrls: [BASE_RPC],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: ['https://basescan.org']
            }]
          })
          setIsOnBase(true)
        } catch {
          addToast({ type: 'error', title: 'Switch Failed', message: 'Could not add/switch to Base.' })
        }
      } else {
        addToast({ type: 'error', title: 'Switch Failed', message: e?.message || 'Could not switch to Base.' })
      }
    }
  }, [addToast])

  // Resize blankIndex if story changes
  useEffect(() => {
    setBlankIndex((i) => Math.max(0, Math.min(Math.max(0, blanksCount - 1), i)))
  }, [blanksCount])

  // USD display (purely informational)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const j = await r.json()
        if (!cancelled) setUsd(Number(j?.ethereum?.usd || 0))
      } catch {
        if (!cancelled) setUsd(null)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Derived parts for contract (keep blanks)
  const parts = useMemo(() => storyToPartsKeepBlanks(story), [story])

  // StyledCard preview: show creatorWord in selected blank
  const wordsMapForPreview = useMemo(() => {
    const w = {}
    for (let i = 0; i < blanksCount; i++) w[i] = ''
    const word = sanitizeOneWord(creatorWord)
    if (blanksCount > 0 && word) w[blankIndex] = word
    return w
  }, [blanksCount, creatorWord, blankIndex])

  const bgCls = useMemo(() => {
    const found = BG_CHOICES.find((b) => b.key === bgKey) || BG_CHOICES[0]
    return found.cls
  }, [bgKey])

  const insertBlankAtCursor = () => {
    const el = storyRef.current
    if (!el) { setStory((s) => s + ' [BLANK] '); return }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const before = story.slice(0, start)
    const after = story.slice(end)
    const next = `${before}[BLANK]${after}`
    setStory(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + '[BLANK]'.length
      el.setSelectionRange(pos, pos)
    })
  }

  const randomizeStarter = () => {
    const pick = PROMPT_STARTERS[(Math.random() * PROMPT_STARTERS.length) | 0]
    setStory(pick)
  }
  const randomizeBackground = () => {
    const idx = BG_CHOICES.findIndex((b) => b.key === bgKey)
    const next = (idx + 1) % BG_CHOICES.length
    setBgKey(BG_CHOICES[next].key)
  }

  // Validate before tx
  const validate = () => {
    if (!POOLS_ADDR) {
      addToast({ type: 'error', title: 'Contract Missing', message: 'Set NEXT_PUBLIC_POOLS_ADDRESS.' })
      return false
    }
    if (!isConnected) {
      addToast({ type: 'error', title: 'Wallet Required', message: 'Connect your wallet to create a round.' })
      return false
    }
    if (!title.trim() || !theme.trim()) {
      addToast({ type: 'error', title: 'Missing Fields', message: 'Title and Theme are required.' })
      return false
    }
    if (parts.length < 2) {
      addToast({ type: 'error', title: 'Add a Blank', message: 'Include at least one [BLANK] in your story.' })
      return false
    }
    const word = sanitizeOneWord(creatorWord)
    if (!word) {
      addToast({ type: 'error', title: 'Your Word', message: 'Enter your one-word entry (letters/numbers/_/-, max 16).' })
      return false
    }
    if (blanksCount < 1) {
      addToast({ type: 'error', title: 'No Blanks', message: 'Story must contain at least one [BLANK].' })
      return false
    }
    if (blankIndex < 0 || blankIndex >= blanksCount) {
      addToast({ type: 'error', title: 'Blank Index', message: 'Select which blank you are filling.' })
      return false
    }
    if (feeWei <= 0n) {
      addToast({ type: 'error', title: 'Entry Fee', message: 'Set a positive entry fee (e.g., 0.0005).' })
      return false
    }
    if (durationSecs < 60n) {
      addToast({ type: 'error', title: 'Duration', message: 'Duration must be at least 1 minute.' })
      return false
    }
    // Byte sanity (not strictly needed here, but helpful)
    if (bytes(title) > 256 || bytes(theme) > 256) {
      addToast({ type: 'error', title: 'Too Long', message: 'Title/Theme are too long.' })
      return false
    }
    // Basic safety for each part size (optional; tweak if you enforce elsewhere)
    for (const p of parts) {
      if (bytes(p) > 2048) {
        addToast({ type: 'error', title: 'Part Too Large', message: 'One of the parts is too large.' })
        return false
      }
    }
    return true
  }

  const handleCreatePool1 = async () => {
    if (!validate()) return
    try {
      setLoading(true)
      const prov = (typeof window !== 'undefined' && window.ethereum) || null
      if (!prov) throw new Error('No wallet provider found')
      await prov.request?.({ method: 'eth_requestAccounts' })

      const browserProvider = new ethers.BrowserProvider(prov)
      const net = await browserProvider.getNetwork()
      if (net?.chainId !== BASE_CHAIN_ID) {
        await switchToBase()
      }

      const signer = await browserProvider.getSigner()
      const ct = new ethers.Contract(POOLS_ADDR, POOLS_ABI, signer)

      const word = sanitizeOneWord(creatorWord)
      const value = feeWei // contract expects payable value == feeBase (creator stakes their own fee)

      const tx = await ct.createPool1(
        String(title).slice(0, 128),
        String(theme).slice(0, 128),
        parts,
        word,
        String(username || '').slice(0, 64),
        value,                          // feeBase (uint256)
        durationSecs,                   // duration (uint256)
        Number(blankIndex) & 0xff,      // blankIndex (uint8)
        { value }
      )
      await tx.wait()

      addToast({ type: 'success', title: 'Round Created!', message: 'Your Pool 1 round is live.' })
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 1600)

      // Simple reset (keep fee/background so flow stays smooth)
      setTitle('')
      setTheme('')
      setUsername('')
      setCreatorWord('')
      setStory(PROMPT_STARTERS[(Math.random() * PROMPT_STARTERS.length) | 0])
      setBlankIndex(0)
    } catch (e) {
      console.error(e)
      const msg = e?.info?.error?.message || e?.shortMessage || e?.reason || e?.message || 'Transaction failed.'
      addToast({ type: 'error', title: 'Create Failed', message: msg })
      setShowConfetti(false)
    } finally {
      setLoading(false)
    }
  }

  // SEO / Frame
  const pageUrl = absoluteUrl('/')
  const ogImage = buildOgUrl({ screen: 'home', title: 'MadFill — Create a Round' })

  return (
    <Layout>
      <Head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="Create a Round" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <SEO
        title="MadFill — Fill the blank, win the pot."
        description="Create a Pool 1 round on Base: pick entry fee, choose your blank, drop your word, and launch."
        url={pageUrl}
        image={ogImage}
        type="website"
        twitterCard="summary_large_image"
      />

      {showConfetti && width > 0 && height > 0 && <Confetti width={width} height={height} />}

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-8 md:pt-12">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900/70 to-purple-900/70 border border-indigo-700 p-6 md:p-8 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">🧠 MadFill — Create a Round</h1>
              <p className="text-indigo-100 mt-3">
                Write your story using <code className="bg-slate-800/80 px-1 rounded">[BLANK]</code> for gaps,
                set the entry fee, choose which blank you’re filling, and launch Pool&nbsp;1 on Base.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isConnected ? (
                <Button onClick={connect} className="bg-amber-500 hover:bg-amber-400 text-black">
                  Connect Wallet
                </Button>
              ) : !isOnBase ? (
                <Button onClick={switchToBase} className="bg-cyan-600 hover:bg-cyan-500">
                  Switch to Base
                </Button>
              ) : null}
            </div>
          </div>

          {/* Fee + Duration summary */}
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <div className="rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2">
              Entry fee per player: <b>{feeEth || '—'} ETH</b>
              {usd && feeEth ? <span className="opacity-80"> (~${(parseFloat(feeEth || '0') * usd).toFixed(2)} USD)</span> : null}
              <span className="opacity-70"> + gas</span>
            </div>
            <div className="rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2">
              Duration: <b>{Math.max(1, Number(durationMins) | 0)} min</b>
            </div>
            <div className="rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2">
              Blanks in story: <b>{blanksCount}</b>
            </div>
          </div>
        </div>
      </section>

      {/* Builder */}
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Round Setup */}
          <Card className="bg-slate-900/70 border border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <h2 className="text-xl font-bold">Round Setup</h2>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-sm text-slate-300 md:col-span-2">
                  Title
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., The Late Night Snack Heist"
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    maxLength={128}
                  />
                </label>

                <label className="text-sm text-slate-300">
                  Theme
                  <input
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="e.g., Comedy"
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    maxLength={128}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-sm text-slate-300 md:col-span-2">
                  Creator username (optional)
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g., noodlelord"
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    maxLength={64}
                  />
                </label>

                <label className="text-sm text-slate-300">
                  Your word (one word)
                  <input
                    value={creatorWord}
                    onChange={(e) => setCreatorWord(sanitizeOneWord(e.target.value))}
                    placeholder="e.g., neon"
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    maxLength={16}
                  />
                  <span className="text-xs text-slate-400">{(creatorWord || '').length}/16</span>
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-slate-300">Story (use <code>[BLANK]</code> for gaps)</label>
                  <div className="flex gap-2">
                    <Button onClick={insertBlankAtCursor} variant="outline" className="border-slate-600 text-slate-200">+ [BLANK]</Button>
                    <Button onClick={randomizeStarter} className="bg-slate-700 hover:bg-slate-600">🎲 Random</Button>
                  </div>
                </div>
                <textarea
                  ref={storyRef}
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  className="w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-400 min-h-[140px] resize-y"
                />
                <div className="text-xs text-slate-400">
                  Current blanks: <b>{blanksCount}</b> • Parts: <b>{parts.length}</b>
                </div>
              </div>

              {/* Blank to fill selector */}
              <div className="space-y-2">
                <div className="text-sm text-slate-300">Choose which blank you’ll fill</div>
                {blanksCount === 0 ? (
                  <div className="text-xs text-amber-300">Add a <code>[BLANK]</code> to your story to proceed.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: blanksCount }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setBlankIndex(i)}
                        className={`px-3 py-1.5 rounded text-sm border ${
                          blankIndex === i ? 'bg-yellow-400 text-black' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                        }`}
                        aria-pressed={blankIndex === i}
                      >
                        Blank #{i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fee selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">Entry Fee (feeBase)</div>
                  <div className="flex gap-2">
                    {['0.0005', '0.001', '0.005'].map((v) => (
                      <button
                        key={v}
                        onClick={() => setFeeEth(v)}
                        className={`px-3 py-1.5 rounded text-sm border ${
                          feeEth === v ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {v} ETH
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="decimal"
                    value={feeEth}
                    onChange={(e) => setFeeEth(e.target.value)}
                    className="w-40 rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <div className="text-sm text-slate-400">
                    {usd && feeEth ? `≈ $${(parseFloat(feeEth || '0') * usd).toFixed(2)} USD` : null}
                    <span className="opacity-70"> + gas</span>
                  </div>
                </div>
              </div>

              {/* Duration selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">Duration (minutes)</div>
                  <div className="flex gap-2">
                    {[30, 60, 120, 240].map((m) => (
                      <button
                        key={m}
                        onClick={() => setDurationMins(m)}
                        className={`px-3 py-1.5 rounded text-sm border ${
                          Number(durationMins) === m ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    value={durationMins}
                    onChange={(e) => setDurationMins(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-40 rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <div className="text-sm text-slate-400">
                    Ends in ~{Math.max(1, Number(durationMins) | 0)} minutes
                  </div>
                </div>
              </div>

              {/* Background selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">Card Background</div>
                  <Button onClick={randomizeBackground} variant="outline" className="border-slate-600 text-slate-200">🔀 Randomize</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {BG_CHOICES.map((bg) => (
                    <button
                      key={bg.key}
                      onClick={() => setBgKey(bg.key)}
                      className={`h-10 w-20 rounded-lg border ${bgKey === bg.key ? 'ring-2 ring-yellow-400' : 'border-slate-600'} bg-gradient-to-br ${bg.cls}`}
                      title={bg.label}
                      aria-pressed={bgKey === bg.key}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right: Preview & Create */}
          <Card className="bg-slate-900/70 border border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <h2 className="text-xl font-bold">Preview & Launch</h2>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="rounded-xl border border-slate-700 p-4 bg-gradient-to-br text-white shadow-inner min-h-[180px]">
                <div className={`rounded-xl p-5 md:p-6 bg-gradient-to-br ${bgCls}`}>
                  <div className="text-xs uppercase tracking-wide opacity-80">{theme || 'Theme'}</div>
                  <div className="text-xl md:text-2xl font-extrabold">{title || 'Your Round Title'}</div>
                  <div className="mt-3 text-base leading-relaxed">
                    <StyledCard
                      parts={parts}
                      blanks={Math.max(0, parts.length - 1)}
                      words={wordsMapForPreview}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    Entry fee per player: <b>{feeEth || '—'} ETH</b>
                    {usd && feeEth ? <span className="opacity-80"> (~${(parseFloat(feeEth || '0') * usd).toFixed(2)} USD)</span> : null}
                    <span className="opacity-70"> + gas</span>
                  </div>
                  <div className="opacity-80">•</div>
                  <div>Blanks in story: <b>{blanksCount}</b></div>
                  <div className="opacity-80">•</div>
                  <div>You’re filling: <b>{blanksCount ? `Blank #${blankIndex + 1}` : '—'}</b></div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleCreatePool1}
                  disabled={
                    loading ||
                    !isConnected ||
                    !title.trim() ||
                    !theme.trim() ||
                    blanksCount < 1 ||
                    !sanitizeOneWord(creatorWord) ||
                    feeWei <= 0n ||
                    durationSecs < 60n
                  }
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 w-full"
                >
                  {loading ? 'Launching…' : 'Launch Pool 1'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTitle('')
                    setTheme('')
                    setUsername('')
                    setCreatorWord('')
                    setStory('')
                    setBlankIndex(0)
                  }}
                  className="border-slate-600 text-slate-200 w-full"
                >
                  Clear
                </Button>
              </div>

              <div className="text-xs text-slate-400">
                Note: You’ll pay the entry fee you set (sent to the pool) plus gas. Players who join later pay the same entry fee.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </Layout>
  )
}

export default dynamic(() => Promise.resolve(IndexPage), { ssr: false })
