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
import { useToast } from '@/components/Toast'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'

// ✅ unified wallet + contracts + tx helpers
import { useTx } from '@/components/TxProvider'

// Client-only confetti (optional flourish)
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

/* ===============================
   Small helpers
=================================*/
const bytes = (s) => new TextEncoder().encode(String(s || '')).length

// Friendly random starters (users can modify freely)
const PROMPT_STARTERS = [
  'My day started with [BLANK], then I found a [BLANK] under the couch.',
  'In space, no one can hear your [BLANK], but everyone sees your [BLANK].',
  'The secret ingredient is always [BLANK], served with a side of [BLANK].',
  'When I opened the door, a [BLANK] yelled “[BLANK]!” from the hallway.',
  'Future me only travels for [BLANK] and exceptional [BLANK].',
  'The prophecy spoke of [BLANK] and the legendary [BLANK].'
]

// Polished gradient / image-like backgrounds (utility classes)
const BG_CHOICES = [
  { key: 'indigoNebula', label: 'Indigo Nebula', cls: 'from-indigo-900 via-purple-800 to-slate-900' },
  { key: 'candy',        label: 'Candy',         cls: 'from-pink-600 via-fuchsia-600 to-purple-700' },
  { key: 'tealSunset',   label: 'Teal Sunset',   cls: 'from-teal-600 via-cyan-700 to-indigo-800' },
  { key: 'magma',        label: 'Magma',         cls: 'from-orange-600 via-rose-600 to-fuchsia-700' },
  { key: 'forest',       label: 'Forest',        cls: 'from-emerald-700 via-teal-700 to-slate-900' },
]

// Convert the author’s story (with [BLANK] markers) to parts.
// If a blank has a fill, we merge it into the previous part (so that blank disappears).
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

/* ===============================
   Minimal ABI for limits, price
=================================*/
const TEMPLATE_ABI = [
  { inputs: [], name: 'MAX_PARTS', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_PART_BYTES', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_TOTAL_BYTES', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getMintPriceWei', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
]

/* ===============================
   Page Component
=================================*/
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

  // On-chain constraints & price
  const [maxParts, setMaxParts] = useState(16)
  const [maxPartBytes, setMaxPartBytes] = useState(256)
  const [maxTotalBytes, setMaxTotalBytes] = useState(2048)
  const [mintPriceWei, setMintPriceWei] = useState(0n)
  const mintPriceEth = useMemo(() => Number(ethers.formatEther(mintPriceWei || 0n)), [mintPriceWei])

  // ETH/USD display (optional nicety)
  const [usd, setUsd] = useState(null)

  // UI state
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
  const [fills, setFills] = useState(Array(blanksInStory).fill('')) // optional pre-fills

  // Background
  const [bgKey, setBgKey] = useState(BG_CHOICES[0].key)

  // Keep fills array aligned with number of [BLANK]s
  useEffect(() => {
    setFills((prev) => {
      const next = Array(blanksInStory).fill('')
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i]
      return next
    })
  }, [blanksInStory])

  // Load on-chain limits + mint price (read-only)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!NFT_ADDRESS) return
      try {
        const provider = new ethers.JsonRpcProvider(BASE_RPC)
        const ct = new ethers.Contract(NFT_ADDRESS, TEMPLATE_ABI, provider)
        const [mp, mpb, mtb, price] = await Promise.all([
          ct.MAX_PARTS().catch(() => 16n),
          ct.MAX_PART_BYTES().catch(() => 256n),
          ct.MAX_TOTAL_BYTES().catch(() => 2048n),
          ct.getMintPriceWei().catch(() => 0n),
        ])
        if (cancelled) return
        setMaxParts(Number(mp))
        setMaxPartBytes(Number(mpb))
        setMaxTotalBytes(Number(mtb))
        setMintPriceWei(BigInt(price || 0n))
      } catch {
        // keep defaults
      }
    })()
    return () => { cancelled = true }
  }, [BASE_RPC, NFT_ADDRESS])

  // ETH/USD for display (does not affect tx)
  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const j = await r.json()
        if (!aborted) setUsd(Number(j?.ethereum?.usd || 0))
      } catch {
        if (!aborted) setUsd(null)
      }
    })()
    return () => { aborted = true }
  }, [])

  // Derived parts (removing blanks the user pre-filled)
  const { parts, blanksRemaining } = useMemo(() => deriveParts(story, fills), [story, fills])

  // Byte accounting
  const partsBytes = useMemo(() => parts.reduce((sum, p) => sum + bytes(p), 0), [parts])
  const totalBytes = bytes(title) + bytes(description) + bytes(theme) + partsBytes

  // Background class
  const bgCls = useMemo(() => {
    const found = BG_CHOICES.find((b) => b.key === bgKey) || BG_CHOICES[0]
    return found.cls
  }, [bgKey])

  // Insert a [BLANK] at cursor position
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

  // Validate before mint
  const validate = () => {
    if (!NFT_ADDRESS) {
      addToast({ type: 'error', title: 'Contract Missing', message: 'Set NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS.' })
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
    if (blanksRemaining < 1) {
      addToast({ type: 'error', title: 'Add a Blank', message: 'Include at least one [BLANK] in your story.' })
      return false
    }
    if (mintPriceWei === 0n) {
      addToast({ type: 'error', title: 'Mint Price Unavailable', message: 'Unable to read on-chain price. Try again.' })
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

      // 🔁 unified TX helper (uses signer + preflight inside provider)
      await mintTemplateNFT(
        String(title).slice(0, 128),
        String(description).slice(0, 2048),
        String(theme).slice(0, 128),
        parts,
        { value: mintPriceWei }
      )

      addToast({ type: 'success', title: 'Minted!', message: 'Your template NFT is live on Base.' })
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 1800)

      // Reset template (keep background)
      setTitle('')
      setTheme('')
      setDescription('')
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

  // Live preview content for StyledCard:
  const wordsForPreview = useMemo(() => {
    const w = {}
    for (let i = 0; i < Math.max(0, parts.length - 1); i++) w[i] = ''
    return w
  }, [parts])

  // Basic SEO / Farcaster
  const pageUrl = absoluteUrl('/myo')
  const ogImage = buildOgUrl({ screen: 'myo', title: 'Make Your Own' })

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
        {/* Header */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">🎨 Make Your Own</h1>
              <p className="text-slate-300">
                Type your story and insert <code className="px-1 py-0.5 bg-slate-800 rounded">[BLANK]</code> wherever players will fill a word.
                Pre-fill any blank you want (optional). Then mint the template NFT.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isConnected ? (
                <Button onClick={connect} className="bg-amber-500 hover:bg-amber-400 text-black">Connect Wallet</Button>
              ) : !isOnBase ? (
                <Button onClick={switchToBase} className="bg-cyan-600 hover:bg-cyan-500">Switch to Base</Button>
              ) : null}
            </div>
          </div>

          {/* Fee pill */}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <div className="rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2">
              Mint fee: <b>{mintPriceWei === 0n ? '—' : `${mintPriceEth.toFixed(6)} ETH`}</b>
              {usd ? <span className="opacity-80"> (~${(mintPriceEth * usd).toFixed(2)} USD)</span> : null}
              <span className="opacity-70"> + gas</span>
            </div>
            <div className="rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2">
              Limits: parts ≤ {maxParts}, part bytes ≤ {maxPartBytes}, total bytes ≤ {maxTotalBytes}
            </div>
            <div className="rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2">
              Remaining blanks in this design: <b>{Math.max(0, parts.length - 1)}</b>
            </div>
          </div>
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
                  Parts now: <b>{parts.length}</b> • Bytes in parts: <b>{partsBytes}</b> • Total bytes: <b>{totalBytes}</b> / {maxTotalBytes}
                </div>
              </div>

              {blanksInStory > 0 && (
                <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                  <div className="text-sm font-semibold mb-2">Optional pre-fill (remove blanks you don’t want)</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {Array.from({ length: blanksInStory }).map((_, i) => (
                      <input
                        key={i}
                        value={fills[i] || ''}
                        onChange={(e) => setFills((old) => {
                          const next = [...old]
                          next[i] = e.target.value
                          return next
                        })}
                        placeholder={`Blank #${i + 1} (leave empty to keep a blank)`}
                        className="rounded-md bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    Any filled blank will become permanent text in the template; unfilled ones remain blanks.
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
                    Mint fee: <b>{mintPriceWei === 0n ? '—' : `${mintPriceEth.toFixed(6)} ETH`}</b>
                    {usd ? <span className="opacity-80"> (~${(mintPriceEth * usd).toFixed(2)} USD)</span> : null}
                    <span className="opacity-70"> + gas at confirmation</span>
                  </div>
                  <div className="opacity-80">•</div>
                  <div>Blanks to fill by players: <b>{Math.max(0, parts.length - 1)}</b></div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleMint}
                  disabled={
                    loading ||
                    !isConnected ||
                    !title.trim() ||
                    !theme.trim() ||
                    !description.trim() ||
                    Math.max(0, parts.length - 1) < 1 ||
                    mintPriceWei === 0n
                  }
                  className="bg-purple-600 hover:bg-purple-500 w-full"
                >
                  {loading ? 'Minting…' : 'Mint Template NFT'}
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
                Tip: If you get an “insufficient funds” error, ensure you’re on Base and have enough ETH for the
                mint fee <i>and</i> gas. The mint fee is read from the contract; gas varies with network conditions.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </Layout>
  )
}

// Prevent SSR wallet probing
export default dynamic(() => Promise.resolve(MYOPage), { ssr: false })
