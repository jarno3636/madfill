// pages/myo.jsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'

import Layout from '@/components/Layout'
import SEO from '@/components/SEO'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMiniWallet } from '@/hooks/useMiniWallet'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import { useToast } from '@/components/Toast'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { categories as presetCategories } from '@/data/templates'

// Client-only confetti
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

/** =========================
 *  Chain / Contract settings
 *  ========================= */
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID = 8453n
const BASE_CHAIN_ID_HEX = '0x2105'

// Your template contract (ERC721) address
const TEMPLATE_ADDR =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F429442' // fallback

// Mint price policy: fixed 0.0005 BASE ETH
const FIXED_PRICE_WEI = ethers.parseEther('0.0005')

// Minimal ABI (read+mint)
const ABI = [
  { inputs: [], name: 'MAX_PARTS', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_PART_BYTES', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_TOTAL_BYTES', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getMintPriceWei', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'paused', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [
      { internalType: 'string', name: 'title', type: 'string' },
      { internalType: 'string', name: 'description', type: 'string' },
      { internalType: 'string', name: 'theme', type: 'string' },
      { internalType: 'string[]', name: 'parts', type: 'string[]' }
    ],
    name: 'mintTemplate',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  }
]

/** =========================
 *  Background swatches
 *  ========================= */
const BACKGROUNDS = [
  { id: 'grad-1', label: 'Indigo → Fuchsia', css: 'linear-gradient(135deg, #3730a3 0%, #c026d3 100%)' },
  { id: 'grad-2', label: 'Blue → Cyan',     css: 'linear-gradient(135deg, #1d4ed8 0%, #06b6d4 100%)' },
  { id: 'grad-3', label: 'Purple Mist',     css: 'linear-gradient(135deg, #7c3aed 0%, #1f2937 100%)' },
  { id: 'grad-4', label: 'Sunset',          css: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)' },
  { id: 'grad-5', label: 'Slate Glow',      css: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)' },
]

/** =========================
 *  Helpers
 *  ========================= */
const utf8BytesLen = (str) => new TextEncoder().encode(str || '').length
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const fmtUsd = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
const fmtEth = (wei) => Number(ethers.formatEther(wei))

/** =========================
 *  Page
 *  ========================= */
export default function MYO() {
  useMiniAppReady()
  const { addToast } = useToast()
  const { width, height } = useWindowSize()

  // Wallet hook used elsewhere in your app
  const { address, isConnected, connect, isLoading: walletLoading } = useMiniWallet()

  // Network/chain observe + switch
  const [isOnBase, setIsOnBase] = useState(true)

  // On-chain limits & price
  const [maxParts, setMaxParts] = useState(16)
  const [maxPartBytes, setMaxPartBytes] = useState(256)
  const [maxTotalBytes, setMaxTotalBytes] = useState(2048)
  const [chainPriceWei, setChainPriceWei] = useState(0n)
  const [paused, setPaused] = useState(false)

  // Price display
  const [usdApprox, setUsdApprox] = useState(null)

  // UI / confetti
  const [isLoading, setIsLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const confettiTimer = useRef(null)

  // Form state
  const [templateTitle, setTemplateTitle] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [templateTheme, setTemplateTheme] = useState('')
  const [storyParts, setStoryParts] = useState([''])
  const [bgId, setBgId] = useState(BACKGROUNDS[0].id)

  // Preset pickers
  const [catIdx, setCatIdx] = useState(0)
  const [tmplIdx, setTmplIdx] = useState(0)

  /** ============
   *  Effects
   *  ============ */
  // Observe chain
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
        } else {
          if (!cancelled) setIsOnBase(true)
        }
      } catch {
        if (!cancelled) setIsOnBase(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Read limits / price / paused
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!TEMPLATE_ADDR) return
        const provider = new ethers.JsonRpcProvider(BASE_RPC)
        const ct = new ethers.Contract(TEMPLATE_ADDR, ABI, provider)

        const [mp, mpb, mtb, price, isPaused] = await Promise.all([
          ct.MAX_PARTS().catch(() => 16n),
          ct.MAX_PART_BYTES().catch(() => 256n),
          ct.MAX_TOTAL_BYTES().catch(() => 2048n),
          ct.getMintPriceWei().catch(() => 0n),
          ct.paused().catch(() => false),
        ])
        if (cancelled) return
        setMaxParts(Number(mp))
        setMaxPartBytes(Number(mpb))
        setMaxTotalBytes(Number(mtb))
        setChainPriceWei(BigInt(price || 0n))
        setPaused(Boolean(isPaused))
      } catch {
        // keep defaults
      }
    })()
    return () => { cancelled = true }
  }, [])

  // USD approximation
  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const j = await r.json()
        const ethUsd = Number(j?.ethereum?.usd || 0)
        if (!aborted && ethUsd > 0) {
          setUsdApprox(fmtEth(FIXED_PRICE_WEI) * ethUsd)
        }
      } catch {
        setUsdApprox(null)
      }
    })()
    return () => { aborted = true }
  }, [])

  useEffect(() => () => clearTimeout(confettiTimer.current), [])

  /** ============
   *  UI helpers
   *  ============ */
  const sanitizeParts = useCallback(
    (parts) =>
      (parts || [])
        .map((p) => (p || '').replace(/\s+/g, ' ').trim())
        .filter((p) => p.length > 0),
    []
  )

  const partsBytes = useMemo(
    () => sanitizeParts(storyParts).reduce((sum, p) => sum + utf8BytesLen(p), 0),
    [storyParts, sanitizeParts]
  )
  const totalBytes = useMemo(() => {
    return utf8BytesLen(templateTitle) + utf8BytesLen(templateDesc) + utf8BytesLen(templateTheme) + partsBytes
  }, [templateTitle, templateDesc, templateTheme, partsBytes])

  const currentCategory = presetCategories[catIdx] || { name: 'Custom', templates: [] }
  const currentTemplates = currentCategory.templates || []
  const currentPreset = currentTemplates[tmplIdx] || null

  const applyPreset = useCallback(() => {
    if (!currentPreset) return
    setTemplateTitle(currentPreset.name || '')
    setTemplateTheme(currentCategory.name || '')
    setStoryParts(currentPreset.parts?.length ? currentPreset.parts : [''])
    if (!templateDesc) {
      setTemplateDesc(`Preset "${currentPreset.name}" in ${currentCategory.name}. Customize before minting.`)
    }
  }, [currentPreset, currentCategory, templateDesc])

  const switchToBase = useCallback(async () => {
    const prov = (typeof window !== 'undefined' && window.ethereum) || null
    if (!prov) {
      addToast({ type: 'error', title: 'No Wallet', message: 'No wallet provider found.' })
      return
    }
    try {
      await prov.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }]
      })
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

  /** ============
   *  Preview render
   *  ============ */
  const selectedBg = useMemo(
    () => BACKGROUNDS.find((b) => b.id === bgId) || BACKGROUNDS[0],
    [bgId]
  )

  // Build a pretty inline preview: part + styled blank + part + ...
  const previewLines = useMemo(() => {
    const parts = sanitizeParts(storyParts)
    if (parts.length === 0) return []
    const out = []
    for (let i = 0; i < parts.length; i++) {
      out.push({ type: 'text', value: parts[i] })
      if (i < parts.length - 1) out.push({ type: 'blank', value: i }) // blank index
    }
    return out
  }, [storyParts, sanitizeParts])

  /** ============
   *  Mint action
   *  ============ */
  const canMint = useMemo(() => {
    if (paused) return false
    if (!TEMPLATE_ADDR) return false
    if (!isConnected || !isOnBase) return false
    const parts = sanitizeParts(storyParts)
    if (!templateTitle || !templateDesc || !templateTheme) return false
    if (parts.length < 2 || parts.length > maxParts) return false
    if (parts.some((p) => utf8BytesLen(p) > maxPartBytes)) return false
    if (totalBytes > maxTotalBytes) return false
    // Must match chain price to avoid revert (your ask)
    if (chainPriceWei !== 0n && chainPriceWei !== FIXED_PRICE_WEI) return false
    return true
  }, [
    paused, isConnected, isOnBase, TEMPLATE_ADDR,
    storyParts, templateTitle, templateDesc, templateTheme,
    maxParts, maxPartBytes, maxTotalBytes, totalBytes, chainPriceWei
  ])

  const priceMismatch = chainPriceWei !== 0n && chainPriceWei !== FIXED_PRICE_WEI

  const handleMintTemplate = async () => {
    const parts = sanitizeParts(storyParts)
    if (!canMint) {
      const reasons = []
      if (paused) reasons.push('Contract is paused')
      if (!isConnected) reasons.push('Wallet not connected')
      if (!isOnBase) reasons.push('Not on Base')
      if (!templateTitle || !templateDesc || !templateTheme) reasons.push('Missing fields')
      if (parts.length < 2) reasons.push('Need at least 2 parts')
      if (parts.length > maxParts) reasons.push(`Max ${maxParts} parts`)
      if (parts.some((p) => utf8BytesLen(p) > maxPartBytes)) reasons.push(`Each part ≤ ${maxPartBytes} bytes`)
      if (totalBytes > maxTotalBytes) reasons.push(`Total bytes ≤ ${maxTotalBytes}`)
      if (priceMismatch) reasons.push('On-chain mint price differs from UI fixed price')
      addToast({ type: 'error', title: 'Cannot Mint', message: reasons.join(' · ') || 'Check form and try again.' })
      return
    }

    try {
      setIsLoading(true)
      const prov = (typeof window !== 'undefined' && window.ethereum) || null
      if (!prov) throw new Error('No wallet provider found')
      await prov.request?.({ method: 'eth_requestAccounts' })

      const browserProvider = new ethers.BrowserProvider(prov)
      const net = await browserProvider.getNetwork()
      if (net?.chainId !== BASE_CHAIN_ID) await switchToBase()

      const signer = await browserProvider.getSigner()
      const ct = new ethers.Contract(TEMPLATE_ADDR, ABI, signer)

      const tx = await ct.mintTemplate(
        String(templateTitle).slice(0, 128),
        String(templateDesc).slice(0, 2048),
        String(templateTheme).slice(0, 128),
        parts,
        { value: FIXED_PRICE_WEI }
      )
      await tx.wait()

      addToast({ type: 'success', title: 'Minted!', message: 'Your template NFT was minted successfully.' })
      setShowConfetti(true)
      clearTimeout(confettiTimer.current)
      confettiTimer.current = setTimeout(() => setShowConfetti(false), 1800)

      // Reset fields (keep background selection)
      setTemplateTitle('')
      setTemplateDesc('')
      setTemplateTheme('')
      setStoryParts([''])
    } catch (error) {
      console.error(error)
      addToast({
        type: 'error',
        title: 'Mint Failed',
        message: error?.shortMessage || error?.reason || error?.message || 'Transaction failed.',
      })
      setShowConfetti(false)
    } finally {
      setIsLoading(false)
    }
  }

  /** ============
   *  SEO / Frames
   *  ============ */
  const pageUrl = absoluteUrl('/myo')
  const ogImage = buildOgUrl({ screen: 'myo', title: 'Make Your Own' })

  return (
    <Layout>
      <Head>
        {/* Farcaster Mini App / Frame meta */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="Create Template" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <SEO
        title="Make Your Own Templates — MadFill"
        description="Start from curated prompts or your own idea and mint as an NFT on Base."
        url={pageUrl}
        image={ogImage}
        type="website"
        twitterCard="summary_large_image"
      />

      {showConfetti && width > 0 && height > 0 && <Confetti width={width} height={height} />}

      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950">
        {/* Header */}
        <div className="relative py-14 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">🎨 Make Your Own Template</h1>
            <p className="text-indigo-200 mt-3">
              Build a story template, pick a background, and mint it as an NFT on Base.
            </p>

            <div className="mt-4 inline-flex items-center gap-2 text-sm text-indigo-200 bg-slate-900/60 border border-indigo-700 px-3 py-1.5 rounded-lg">
              <span className="font-semibold">Mint Price:</span>
              <span className="text-white">{fmtEth(FIXED_PRICE_WEI)} BASE</span>
              <span>+ gas</span>
              {usdApprox != null && <span className="opacity-80">({fmtUsd(usdApprox)} approx)</span>}
            </div>

            <div className="mt-3 text-xs text-indigo-300">
              We send the exact fixed price. If the contract price differs, minting is disabled to avoid reverts.
            </div>

            {!isConnected ? (
              <div className="mt-5">
                <Button
                  onClick={connect}
                  disabled={walletLoading}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-semibold px-5 py-2.5 rounded-lg"
                >
                  {walletLoading ? 'Connecting…' : 'Connect Wallet'}
                </Button>
              </div>
            ) : (
              <div className="mt-5 inline-flex items-center gap-3 bg-green-900/20 border border-green-600/40 text-green-200 px-3 py-2 rounded-lg">
                <span className="text-xs">Connected</span>
                <span className="font-mono text-white">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
                {!isOnBase && (
                  <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600 text-xs">
                    Switch to Base
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main */}
        <div className="max-w-6xl mx-auto px-4 pb-20 grid lg:grid-cols-3 gap-8">
          {/* Left: Preset + Background */}
          <Card className="bg-slate-900/70 border-indigo-900/40">
            <CardHeader>
              <h2 className="text-xl text-white font-bold">Start from a Preset</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block text-sm text-indigo-200">Category</label>
              <select
                value={catIdx}
                onChange={(e) => { setCatIdx(Number(e.target.value)); setTmplIdx(0) }}
                className="w-full px-3 py-2 rounded-lg bg-slate-800/70 text-white border border-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                {presetCategories.map((c, i) => (
                  <option key={c.name || i} value={i} className="bg-slate-900 text-white">
                    {c.name || `Category ${i + 1}`}
                  </option>
                ))}
              </select>

              <label className="block text-sm text-indigo-200">Template</label>
              <select
                value={tmplIdx}
                onChange={(e) => setTmplIdx(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-800/70 text-white border border-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                {currentTemplates.map((t, i) => (
                  <option key={t.id ?? i} value={i} className="bg-slate-900 text-white">
                    {(t.name || `Template ${i + 1}`)} ({t.blanks} blanks)
                  </option>
                ))}
              </select>

              <Button onClick={applyPreset} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500" type="button">
                Use This Preset
              </Button>

              <div className="pt-4 border-t border-slate-800/60">
                <div className="text-sm text-white font-semibold mb-2">Card Background</div>
                <div className="grid grid-cols-5 gap-3">
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setBgId(bg.id)}
                      className={`h-12 rounded-lg ring-2 ring-offset-2 ring-offset-slate-900 transition ${
                        bgId === bg.id ? 'ring-fuchsia-400' : 'ring-transparent hover:ring-indigo-400/60'
                      }`}
                      style={{ background: bg.css }}
                      aria-label={bg.label}
                      title={bg.label}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Middle: Form */}
          <Card className="bg-slate-900/70 border-indigo-900/40">
            <CardHeader>
              <h2 className="text-xl text-white font-bold">Template Details</h2>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm text-indigo-200 mb-1">Title</label>
                <input
                  type="text"
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  placeholder="e.g., The Great Adventure"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/70 text-white border border-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none"
                />
                <div className="text-xs text-slate-400 mt-1">{utf8BytesLen(templateTitle)} bytes</div>
              </div>

              <div>
                <label className="block text-sm text-indigo-200 mb-1">Description</label>
                <textarea
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  placeholder="Describe your template for the NFT metadata"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/70 text-white border border-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none h-24 resize-none"
                />
                <div className="text-xs text-slate-400 mt-1">{utf8BytesLen(templateDesc)} bytes</div>
              </div>

              <div>
                <label className="block text-sm text-indigo-200 mb-1">Theme</label>
                <input
                  type="text"
                  value={templateTheme}
                  onChange={(e) => setTemplateTheme(e.target.value)}
                  placeholder="e.g., Space Adventure"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/70 text-white border border-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none"
                />
                <div className="text-xs text-slate-400 mt-1">{utf8BytesLen(templateTheme)} bytes</div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-indigo-200 mb-1">Story Parts</label>
                  <div className="text-xs text-slate-400">
                    Parts: {sanitizeParts(storyParts).length}/{maxParts} • Bytes in parts: {partsBytes}
                  </div>
                </div>

                {/* Each part with removable control */}
                {storyParts.map((part, i) => (
                  <div key={i} className="mb-3">
                    <div className="flex gap-2">
                      <textarea
                        value={part}
                        onChange={(e) => setStoryParts((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))}
                        placeholder={`Story part ${i + 1}...`}
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-800/70 text-white border border-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none h-20 resize-none"
                      />
                      {storyParts.length > 1 && (
                        <Button
                          onClick={() => setStoryParts((p) => p.filter((_, idx) => idx !== i))}
                          variant="outline"
                          className="px-3 py-2 text-red-300 border-red-300 hover:bg-red-500/20"
                          type="button"
                          title="Remove this part"
                        >
                          ✕
                        </Button>
                      )}
                    </div>

                    {/* A visual hint: between each part is a blank */}
                    {i < storyParts.length - 1 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-8 px-3 inline-flex items-center rounded-lg bg-fuchsia-700/30 border border-fuchsia-500/40 text-fuchsia-200 text-sm">
                          [ blank ]
                        </div>
                        <div className="text-xs text-slate-400">Players will fill this blank</div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between">
                  <Button
                    onClick={() => setStoryParts((p) => [...p, ''])}
                    variant="outline"
                    className="py-2 border-dashed border-indigo-400 text-indigo-300 hover:border-indigo-300 hover:text-indigo-200"
                    type="button"
                  >
                    + Add Another Part
                  </Button>
                  <div className="text-xs text-slate-400">
                    Total payload bytes: <b>{totalBytes}</b> / {maxTotalBytes}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right: Live Card Preview + Mint */}
          <div className="space-y-6">
            <Card className="bg-slate-900/70 border-indigo-900/40">
              <CardHeader>
                <h2 className="text-xl text-white font-bold">Live Preview</h2>
              </CardHeader>
              <CardContent>
                {/* Fixed ratio card, centered, with selectable background */}
                <div className="mx-auto w-full max-w-md">
                  <div
                    className="relative rounded-2xl shadow-2xl ring-1 ring-white/10 overflow-hidden"
                    style={{
                      background: selectedBg.css,
                      aspectRatio: '3 / 4',
                    }}
                  >
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="relative h-full w-full p-5 flex flex-col">
                      <div className="text-xs uppercase tracking-widest text-white/80">{templateTheme || 'Theme'}</div>
                      <div className="mt-1 text-white font-extrabold text-2xl leading-tight line-clamp-2">
                        {templateTitle || 'Your Template'}
                      </div>

                      <div className="mt-3 text-base leading-relaxed text-white/95 bg-white/10 rounded-xl p-3 backdrop-blur">
                        {previewLines.length === 0 ? (
                          <span className="text-white/70 italic">Add at least two parts below — blanks will appear between them.</span>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">
                            {previewLines.map((seg, idx) =>
                              seg.type === 'text' ? (
                                <span key={idx}>{seg.value}</span>
                              ) : (
                                <span
                                  key={idx}
                                  className="align-baseline inline-block min-w-[60px] px-2 py-0.5 mx-1 text-center rounded-md bg-yellow-300 text-black font-semibold"
                                  title={`Blank #${seg.value + 1}`}
                                >
                                  ____ 
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-3 text-white/90">
                        <div className="text-xs">madfill • base</div>
                        <div className="text-xs">
                          {sanitizeParts(storyParts).length - 1 >= 0 ? `${sanitizeParts(storyParts).length - 1} blanks` : '0 blanks'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mint Panel */}
            <Card className="bg-slate-900/70 border-indigo-900/40">
              <CardContent className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-indigo-200">
                    <span className="font-semibold text-white">Mint Price:</span>{' '}
                    <span className="text-white">{fmtEth(FIXED_PRICE_WEI)} BASE</span>{' '}
                    <span className="opacity-80">+ gas</span>
                    {usdApprox != null && <span className="ml-2 opacity-80">({fmtUsd(usdApprox)} approx)</span>}
                  </div>
                  {priceMismatch && (
                    <div className="text-xs text-amber-300 bg-amber-900/30 border border-amber-600/40 px-2 py-1 rounded">
                      On-chain price differs — update fixed price or contract.
                    </div>
                  )}
                  {paused && (
                    <div className="text-xs text-rose-300 bg-rose-900/30 border border-rose-600/40 px-2 py-1 rounded">
                      Contract is paused
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleMintTemplate}
                  disabled={!canMint || isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg disabled:opacity-50"
                  type="button"
                >
                  {isLoading
                    ? 'Minting…'
                    : `Mint Template (${fmtEth(FIXED_PRICE_WEI)} BASE + gas)`}
                </Button>

                {!isConnected && (
                  <p className="text-yellow-400 text-xs text-center">Connect your wallet to mint</p>
                )}
                {isConnected && !isOnBase && (
                  <div className="text-center">
                    <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600 text-xs">
                      Switch to Base
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </Layout>
  )
}
