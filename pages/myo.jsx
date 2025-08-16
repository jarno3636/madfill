// pages/myo.jsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useToast } from '@/components/Toast'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useTx } from '@/components/TxProvider'

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

/* ---------- helpers ---------- */
const bytes = (s) => new TextEncoder().encode(String(s || '')).length
const fmtUsd = (n) => (Number.isFinite(n) ? `$${n.toFixed(2)}` : '—')

const PROMPT_STARTERS = [
  'My day started with [BLANK], then I found a [BLANK] under the couch.',
  'In space, no one can hear your [BLANK], but everyone sees your [BLANK].',
  'The secret ingredient is always [BLANK], served with a side of [BLANK].',
  'When I opened the door, a [BLANK] yelled “[BLANK]!” from the hallway.',
  'Future me only travels for [BLANK] and exceptional [BLANK].',
  'The prophecy spoke of [BLANK] and the legendary [BLANK].',
]

const BG_CHOICES = [
  { key: 'indigoNebula', label: 'Indigo Nebula', cls: 'from-indigo-900 via-purple-800 to-slate-900' },
  { key: 'candy',        label: 'Candy',         cls: 'from-pink-600 via-fuchsia-600 to-purple-700' },
  { key: 'tealSunset',   label: 'Teal Sunset',   cls: 'from-teal-600 via-cyan-700 to-indigo-800' },
  { key: 'magma',        label: 'Magma',         cls: 'from-orange-600 via-rose-600 to-fuchsia-700' },
  { key: 'forest',       label: 'Forest',        cls: 'from-emerald-700 via-teal-700 to-slate-900' },
]

// Convert story with [BLANK]s → parts (filled blanks get merged into previous part)
function deriveParts(story, fills) {
  const chunks = String(story || '').split(/\[BLANK\]/g)
  const blanks = Math.max(0, chunks.length - 1)
  const safeFills = Array.from({ length: blanks }, (_, i) => (fills?.[i] || '').trim())
  if (chunks.length === 0) return { parts: [''], blanksRemaining: 0 }
  const parts = [chunks[0] || '']
  for (let i = 0; i < blanks; i++) {
    const fill = safeFills[i]
    const nextText = chunks[i + 1] || ''
    if (fill) {
      parts[parts.length - 1] = parts[parts.length - 1] + fill + nextText
    } else {
      parts.push(nextText)
    }
  }
  return { parts, blanksRemaining: Math.max(0, parts.length - 1) }
}

/* ---------- minimal read ABI ---------- */
const TEMPLATE_ABI = [
  { inputs: [], name: 'MAX_PARTS', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_PART_BYTES', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_TOTAL_BYTES', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getMintPriceWei', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'mintPriceUsdE6', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'paused', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
]

function MYOPage() {
  useMiniAppReady()
  const { addToast } = useToast()
  const { width, height } = useWindowSize()

  // ✅ unified provider bits
  const {
    isConnected, connect, isOnBase, switchToBase,
    BASE_RPC, NFT_ADDRESS,
    mintTemplateNFT,
  } = useTx()

  // Limits/state
  const [maxParts, setMaxParts] = useState(24)
  const [maxPartBytes, setMaxPartBytes] = useState(96)
  const [maxTotalBytes, setMaxTotalBytes] = useState(4096)
  const [paused, setPaused] = useState(false)

  // Pricing (on-chain if available; otherwise fixed fallback)
  const [mintPriceWeiOnchain, setMintPriceWeiOnchain] = useState(0n)
  const [mintPriceUsdE6, setMintPriceUsdE6] = useState(0n)
  const [priceLoading, setPriceLoading] = useState(true)

  // Fallback fee: overrideable via env
  const FIXED_FEE_WEI =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MYO_FIXED_FEE_WEI)
      ? BigInt(process.env.NEXT_PUBLIC_MYO_FIXED_FEE_WEI)
      : ethers.parseEther('0.0005') // 0.0005 ETH

  // Value to send with tx (prefer on-chain when present)
  const valueWei = useMemo(
    () => (mintPriceWeiOnchain > 0n ? mintPriceWeiOnchain : FIXED_FEE_WEI),
    [mintPriceWeiOnchain, FIXED_FEE_WEI]
  )
  const valueEth = useMemo(() => Number(ethers.formatEther(valueWei)), [valueWei])

  const [usdSpot, setUsdSpot] = useState(null) // display only
  const [loading, setLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  // Template meta
  const [title, setTitle] = useState('')
  const [theme, setTheme] = useState('')
  const [description, setDescription] = useState('')

  // Story + blanks
  const storyRef = useRef(null)
  const [story, setStory] = useState(PROMPT_STARTERS[0])
  const blanksInStory = Math.max(0, story.split(/\[BLANK\]/g).length - 1)
  const [fills, setFills] = useState(Array(blanksInStory).fill(''))

  // Background
  const [bgKey, setBgKey] = useState(BG_CHOICES[0].key)

  // Keep fills aligned with number of [BLANK]s
  useEffect(() => {
    setFills((prev) => {
      const next = Array(blanksInStory).fill('')
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i]
      return next
    })
  }, [blanksInStory])

  // Load limits + paused + *optional* price (we won’t block on failures)
  useEffect(() => {
    if (!NFT_ADDRESS) return
    const provider = new ethers.JsonRpcProvider(BASE_RPC)
    const ct = new ethers.Contract(NFT_ADDRESS, TEMPLATE_ABI, provider)

    let mounted = true
    const pull = async () => {
      try {
        setPriceLoading(true)
        const [mp, mpb, mtb, priceWei, priceUsd, isPaused] = await Promise.all([
          ct.MAX_PARTS().catch(() => null),
          ct.MAX_PART_BYTES().catch(() => null),
          ct.MAX_TOTAL_BYTES().catch(() => null),
          ct.getMintPriceWei().catch(() => 0n),
          ct.mintPriceUsdE6().catch(() => 0n),
          ct.paused().catch(() => false),
        ])
        if (!mounted) return
        if (mp) setMaxParts(Number(mp))
        if (mpb) setMaxPartBytes(Number(mpb))
        if (mtb) setMaxTotalBytes(Number(mtb))
        setMintPriceWeiOnchain(BigInt(priceWei || 0n))
        setMintPriceUsdE6(BigInt(priceUsd || 0n))
        setPaused(Boolean(isPaused))
      } finally {
        if (mounted) setPriceLoading(false)
      }
    }

    pull()
    const id = setInterval(pull, 60_000)
    const onVis = () => { if (document.visibilityState === 'visible') pull() }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      mounted = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [BASE_RPC, NFT_ADDRESS])

  // ETH→USD spot (display only)
  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const j = await r.json()
        if (!aborted) setUsdSpot(Number(j?.ethereum?.usd || 0))
      } catch {
        if (!aborted) setUsdSpot(null)
      }
    })()
    return () => { aborted = true }
  }, [])

  // Derived parts & byte accounting
  const { parts, blanksRemaining } = useMemo(() => deriveParts(story, fills), [story, fills])
  const partsBytes = useMemo(() => parts.reduce((sum, p) => sum + bytes(p), 0), [parts])
  const totalBytes = bytes(title) + bytes(description) + bytes(theme) + partsBytes

  // Background class
  const bgCls = useMemo(() => (BG_CHOICES.find((b) => b.key === bgKey) || BG_CHOICES[0]).cls, [bgKey])

  // Editor helpers
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
    const pick = PROMPT_STARTERS[Math.floor(Math.random() * PROMPT_STARTERS.length)]
    setStory(pick)
    setFills([]) // will resize automatically
  }

  const randomizeBackground = () => {
    const idx = BG_CHOICES.findIndex((b) => b.key === bgKey)
    const next = (idx + 1) % BG_CHOICES.length
    setBgKey(BG_CHOICES[next].key)
  }

  // Validation
  const validate = () => {
    if (!NFT_ADDRESS) {
      addToast({ type: 'error', title: 'Contract Missing', message: 'Set NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS.' })
      return false
    }
    if (paused) {
      addToast({ type: 'error', title: 'Paused', message: 'Minting is currently paused.' })
      return false
    }
    if (!isConnected) {
      addToast({ type: 'error', title: 'Wallet Required', message: 'Please connect your wallet.' })
      return false
    }
    if (!title.trim() || !theme.trim() || !description.trim()) {
      addToast({ type: 'error', title: 'Missing Fields', message: 'Title, Theme, and Description are required.' })
      return false
    }
    if (parts.length > maxParts) {
      addToast({ type: 'error', title: 'Too Many Parts', message: `Max ${maxParts} parts.` })
      return false
    }
    if (parts.some((p) => bytes(p) > maxPartBytes)) {
      addToast({ type: 'error', title: 'Part Too Long', message: `Each part must be ≤ ${maxPartBytes} bytes.` })
      return false
    }
    if (totalBytes > maxTotalBytes) {
      addToast({ type: 'error', title: 'Too Large', message: `Total bytes must be ≤ ${maxTotalBytes}.` })
      return false
    }
    return true
  }

  const handleMint = async () => {
    if (!validate()) return
    try {
      setLoading(true)
      if (!isOnBase) {
        const ok = await switchToBase()
        if (!ok) throw new Error('Please switch to Base.')
      }

      const usingFallback = mintPriceWeiOnchain === 0n
      const tx = await mintTemplateNFT(
        String(title).slice(0, 128),
        String(description).slice(0, 2048),
        String(theme).slice(0, 128),
        parts,
        { value: valueWei }
      )

      const hash = tx?.hash || tx?.transactionHash
      addToast({
        type: 'success',
        title: usingFallback ? 'Mint submitted (fallback fee)' : 'Mint submitted',
        message: hash ? `Tx: ${hash.slice(0, 10)}…` : 'Waiting for confirmations…',
        link: hash ? `https://basescan.org/tx/${hash}` : undefined,
      })

      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 1800)

      // Reset (keep background)
      setTitle(''); setTheme(''); setDescription('')
      setStory(PROMPT_STARTERS[Math.floor(Math.random() * PROMPT_STARTERS.length)])
      setFills([])
    } catch (e) {
      console.error(e)
      const msg = e?.info?.error?.message || e?.shortMessage || e?.reason || e?.message || 'Transaction failed.'
      addToast({ type: 'error', title: 'Mint Failed', message: msg })
      setShowConfetti(false)
    } finally {
      setLoading(false)
    }
  }

  const wordsForPreview = useMemo(() => {
    const w = {}
    for (let i = 0; i < Math.max(0, parts.length - 1); i++) w[i] = ''
    return w
  }, [parts])

  const pageUrl = absoluteUrl('/myo')
  const ogImage = buildOgUrl({ screen: 'myo', title: 'Make Your Own' })

  const canMint =
    !loading &&
    isConnected &&
    !paused &&
    title.trim() &&
    theme.trim() &&
    description.trim() &&
    Math.max(0, parts.length - 1) >= 1

  const usingFallback = mintPriceWeiOnchain === 0n

  return (
    <Layout>
      <Head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="Create Template" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <SEO
        title="Make Your Own — MadFill Templates"
        description="Type your story, drop [BLANK] anywhere, pick a background, and mint as an NFT on Base."
        url={pageUrl}
        image={ogImage}
        type="website"
        twitterCard="summary_large_image"
      />

      {showConfetti && width > 0 && height > 0 && <Confetti width={width} height={height} />}

      <main className="max-w-6xl mx-auto p-4 md:p-6 text-white space-y-6">
        {/* Explainer */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">🎨 Make Your Own</h1>
              <p className="text-slate-300">
                Drop <code className="px-1 py-0.5 bg-slate-800 rounded">[BLANK]</code> anywhere words should be filled.
                Pick a vibe, then mint a Template NFT on <span className="font-semibold">Base</span>.
              </p>
              <ul className="mt-3 grid gap-2 text-slate-300 text-sm md:grid-cols-3">
                <li className="rounded-xl bg-slate-800/60 border border-slate-700 p-3">✍️ <b>Write</b> a prompt with blanks.</li>
                <li className="rounded-xl bg-slate-800/60 border border-slate-700 p-3">🧩 <b>Set</b> a theme & background.</li>
                <li className="rounded-xl bg-slate-800/60 border border-slate-700 p-3">🪄 <b>Mint</b> the template as an NFT.</li>
              </ul>
            </div>
            <div className="flex items-center gap-2">
              {!isConnected ? (
                <Button onClick={connect} className="bg-amber-500 hover:bg-amber-400 text-black">Connect Wallet</Button>
              ) : !isOnBase ? (
                <Button onClick={switchToBase} className="bg-cyan-600 hover:bg-cyan-500">Switch to Base</Button>
              ) : null}
            </div>
          </div>

          {/* Fee / limits */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className={`rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 flex items-center gap-2`}>
              <span>Mint fee:</span>
              <b>{valueEth.toFixed(6)} ETH</b>
              {usdSpot ? <span className="opacity-80">({fmtUsd(valueEth * usdSpot)})</span> : null}
              <span className="opacity-70">+ gas</span>
              {usingFallback && (
                <span className="ml-auto text-[10px] uppercase tracking-wide rounded bg-amber-500/20 text-amber-200 px-2 py-0.5 border border-amber-500/40">
                  fallback fee
                </span>
              )}
            </div>

            <div className="rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2">
              <div className="flex items-center justify-between">
                <span>Parts</span>
                <span className="font-semibold">{Math.max(1, parts.length)} / {maxParts}</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-slate-700">
                <div
                  className="h-1.5 rounded bg-indigo-400"
                  style={{ width: `${Math.min(100, (Math.max(1, parts.length) / maxParts) * 100)}%` }}
                />
              </div>
            </div>

            <div className="rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2">
              <div className="flex items-center justify-between">
                <span>Total bytes</span>
                <span className="font-semibold">{totalBytes} / {maxTotalBytes}</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-slate-700">
                <div
                  className="h-1.5 rounded bg-emerald-400"
                  style={{ width: `${Math.min(100, (totalBytes / maxTotalBytes) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {!priceLoading && mintPriceUsdE6 > 0 && (
            <div className="mt-2 text-xs text-slate-400">
              Note: Contract target ≈ {fmtUsd(Number(mintPriceUsdE6) / 1e6)}; app uses fixed fee if price is unavailable.
            </div>
          )}

          {paused && (
            <div className="mt-3 text-sm rounded-lg bg-rose-900/40 border border-rose-700 px-3 py-2 text-rose-100">
              ⏸️ Minting is currently paused.
            </div>
          )}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Builder */}
          <Card className="bg-slate-900/70 border border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <h2 className="text-xl font-bold">Story Builder</h2>
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
                  <span className="text-xs text-slate-400">{bytes(title)} / 128 bytes</span>
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
                  <span className="text-xs text-slate-400">{bytes(theme)} / 128 bytes</span>
                </label>
              </div>

              <label className="block text-sm text-slate-300">
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description for the NFT metadata."
                  className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400 h-20 resize-y"
                  maxLength={2048}
                />
                <span className="text-xs text-slate-400">{bytes(description)} / 2048 bytes</span>
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-slate-300">Story (use <code>[BLANK]</code>)</label>
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
                  Parts: <b>{Math.max(1, parts.length)}</b> / {maxParts} • Bytes in parts: <b>{partsBytes}</b> • Total bytes: <b>{totalBytes}</b> / {maxTotalBytes}
                </div>
              </div>

              {blanksInStory > 0 && (
                <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                  <div className="text-sm font-semibold mb-2">Optional pre-fill</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {Array.from({ length: blanksInStory }).map((_, i) => (
                      <input
                        key={i}
                        value={fills[i] || ''}
                        onChange={(e) => setFills((old) => {
                          const next = [...old]; next[i] = e.target.value; return next
                        })}
                        placeholder={`Blank #${i + 1} (leave empty to keep a blank)`}
                        className="rounded-md bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    Filled blanks become permanent text; unfilled ones remain blanks.
                  </div>
                </div>
              )}

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

          {/* Right: Preview + Mint */}
          <Card className="bg-slate-900/70 border border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <h2 className="text-xl font-bold">Preview & Mint</h2>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="rounded-xl border border-slate-700 p-4 bg-gradient-to-br text-white shadow-inner min-h-[180px]">
                <div className={`rounded-xl p-5 md:p-6 bg-gradient-to-br ${bgCls}`}>
                  <div className="text-xs uppercase tracking-wide opacity-80">{theme || 'Theme'}</div>
                  <div className="text-xl md:text-2xl font-extrabold">{title || 'Your Template Title'}</div>
                  <div className="mt-3 text-base leading-relaxed">
                    <StyledCard parts={parts} blanks={Math.max(0, parts.length - 1)} words={wordsForPreview} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    Mint fee: <b>{valueEth.toFixed(6)} ETH</b>
                    {usdSpot ? <span className="opacity-80"> ({fmtUsd(valueEth * usdSpot)})</span> : null}
                    <span className="opacity-70"> + gas at confirmation</span>
                  </div>
                  {usingFallback && <span className="text-[10px] uppercase tracking-wide rounded bg-amber-500/20 text-amber-200 px-2 py-0.5 border border-amber-500/40">fallback</span>}
                  <div className="opacity-80">•</div>
                  <div>Blanks to fill by players: <b>{Math.max(0, parts.length - 1)}</b></div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleMint}
                  disabled={!canMint}
                  className={`w-full ${paused ? 'bg-slate-700' : 'bg-purple-600 hover:bg-purple-500'}`}
                  title={!isConnected ? 'Connect wallet' : paused ? 'Minting paused' : ''}
                >
                  {loading ? 'Minting…' : paused ? 'Paused' : 'Mint Template NFT'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTitle('')
                    setTheme('')
                    setDescription('')
                    setStory('')
                    setFills([])
                  }}
                  className="border-slate-600 text-slate-200 w-full"
                >
                  Clear All
                </Button>
              </div>

              <div className="text-xs text-slate-400">
                If a tx fails with “insufficient value”, the contract may require a higher price.
                Try again after the on-chain price loads, or contact support.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </Layout>
  )
}

export default dynamic(() => Promise.resolve(MYOPage), { ssr: false })
