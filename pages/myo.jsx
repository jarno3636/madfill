// pages/myo.jsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMiniWallet } from '@/hooks/useMiniWallet'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import { useToast } from '@/components/Toast'
import SEO from '@/components/SEO'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import dynamic from 'next/dynamic'

// Client-only confetti
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

// 🔹 Preset templates
import { categories as presetCategories } from '@/data/templates'

// ---- Chain / Contract ----
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID = 8453n
const BASE_CHAIN_ID_HEX = '0x2105'
const TEMPLATE_ADDR =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F429442' // fallback

// Minimal ABI
const ABI = [
  { inputs: [], name: 'MAX_PARTS', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_PART_BYTES', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_TOTAL_BYTES', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getMintPriceWei', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
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

export default function MYO() {
  useMiniAppReady()
  const { addToast } = useToast()
  const { address, isConnected, connect, isLoading: walletLoading } = useMiniWallet()

  // Network observe + switch
  const [isOnBase, setIsOnBase] = useState(true)

  // Confetti
  const [showConfetti, setShowConfetti] = useState(false)
  const { width, height } = useWindowSize()
  const confettiTimer = useRef(null)

  // Form state
  const [isLoading, setIsLoading] = useState(false)
  const [templateTitle, setTemplateTitle] = useState('')
  const [templateDesc, setTemplateDesc] = useState('') // required by contract
  const [templateTheme, setTemplateTheme] = useState('')
  const [storyParts, setStoryParts] = useState([''])

  // Preset pickers
  const [catIdx, setCatIdx] = useState(0)
  const [tmplIdx, setTmplIdx] = useState(0)

  // On-chain limits
  const [maxParts, setMaxParts] = useState(16)
  const [maxPartBytes, setMaxPartBytes] = useState(256)
  const [maxTotalBytes, setMaxTotalBytes] = useState(2048)

  // On-chain mint price
  const [mintPriceWei, setMintPriceWei] = useState(0n)
  const [usdApprox, setUsdApprox] = useState(null)

  // ---- UI helpers ----
  const sanitizeParts = useCallback(
    (parts) =>
      (parts || [])
        .map((p) => (p || '').replace(/\s+/g, ' ').trim())
        .filter((p) => p.length > 0),
    []
  )

  // Wallet / chain observe only
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

  // Read on-chain limits + price
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!TEMPLATE_ADDR) return
        const provider = new ethers.JsonRpcProvider(BASE_RPC)
        const ct = new ethers.Contract(TEMPLATE_ADDR, ABI, provider)

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
  }, [])

  // USD display (informational)
  useEffect(() => {
    let aborted = false
    ;(async () => {
      if (mintPriceWei === 0n) { setUsdApprox(null); return }
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const j = await r.json()
        const ethUsd = Number(j?.ethereum?.usd || 0)
        if (!aborted && ethUsd > 0) {
          const eth = Number(ethers.formatEther(mintPriceWei))
          setUsdApprox(eth * ethUsd)
        }
      } catch {
        setUsdApprox(null)
      }
    })()
    return () => { aborted = true }
  }, [mintPriceWei])

  // Byte helpers
  const utf8BytesLen = (str) => new TextEncoder().encode(str || '').length
  const partsBytes = useMemo(() => sanitizeParts(storyParts).reduce((sum, p) => sum + utf8BytesLen(p), 0), [storyParts, sanitizeParts])
  const titleBytes = utf8BytesLen(templateTitle)
  const themeBytes = utf8BytesLen(templateTheme)
  const descBytes  = utf8BytesLen(templateDesc)
  const totalBytes = titleBytes + themeBytes + descBytes + partsBytes

  // 🔹 Load preset into form
  const currentCategory = presetCategories[catIdx] || { name: 'Custom', templates: [] }
  const currentTemplates = currentCategory.templates || []
  const currentPreset = currentTemplates[tmplIdx] || null

  const applyPreset = useCallback(() => {
    if (!currentPreset) return
    // Fill form from preset: title, theme (category), parts; keep / append to description
    setTemplateTitle(currentPreset.name || '')
    setTemplateTheme(currentCategory.name || '')
    setStoryParts(currentPreset.parts || [''])
    if (!templateDesc) {
      setTemplateDesc(`Preset "${currentPreset.name}" in ${currentCategory.name}. Customize before minting.`)
    }
  }, [currentPreset, currentCategory, templateDesc])

  // Mint action
  const handleMintTemplate = async () => {
    if (!TEMPLATE_ADDR) {
      addToast({ type: 'error', title: 'Contract Missing', message: 'Set NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS.' })
      return
    }
    if (!isConnected) {
      addToast({ type: 'error', title: 'Wallet Required', message: 'Please connect your wallet to mint.' })
      return
    }

    const parts = sanitizeParts(storyParts)
    if (!templateTitle || !templateTheme || !templateDesc || parts.length < 2) {
      addToast({
        type: 'error',
        title: 'Missing Fields',
        message: 'Title, description, theme, and at least two story parts are required.',
      })
      return
    }
    if (parts.length > maxParts) {
      addToast({ type: 'error', title: 'Too Many Parts', message: `Max ${maxParts} parts.` })
      return
    }
    if (parts.some((p) => utf8BytesLen(p) > maxPartBytes)) {
      addToast({ type: 'error', title: 'Part Too Long', message: `Each part must be ≤ ${maxPartBytes} bytes.` })
      return
    }
    if (totalBytes > maxTotalBytes) {
      addToast({
        type: 'error',
        title: 'Template Too Large',
        message: `Total bytes (title+desc+theme+parts) must be ≤ ${maxTotalBytes}.`,
      })
      return
    }
    if (mintPriceWei === 0n) {
      addToast({ type: 'error', title: 'Price Unavailable', message: 'Unable to fetch on-chain mint price. Try again.' })
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

      // Send EXACT on-chain price (no arbitrary buffer)
      const tx = await ct.mintTemplate(
        String(templateTitle).slice(0, 128),
        String(templateDesc).slice(0, 2048),
        String(templateTheme).slice(0, 128),
        parts,
        { value: mintPriceWei }
      )
      await tx.wait()

      addToast({ type: 'success', title: 'NFT Minted!', message: 'Your template was minted successfully.' })
      setShowConfetti(true)
      clearTimeout(confettiTimer.current)
      confettiTimer.current = setTimeout(() => setShowConfetti(false), 1800)

      // reset (keep chosen category/template selection)
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

  useEffect(() => () => clearTimeout(confettiTimer.current), [])

  // ---- SEO / Farcaster ----
  const pageUrl = absoluteUrl('/myo')
  const ogImage = buildOgUrl({ screen: 'myo', title: 'Make Your Own' })
  const mintPriceEth = useMemo(() => Number(ethers.formatEther(mintPriceWei || 0n)), [mintPriceWei])

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
        description="Start from curated prompts or your own idea and mint as an NFT on Base. Price is set on-chain."
        url={pageUrl}
        image={ogImage}
        type="website"
        twitterCard="summary_large_image"
      />

      {showConfetti && width > 0 && height > 0 && <Confetti width={width} height={height} />}

      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        {/* Header */}
        <div className="relative py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-8xl mb-6">🎨</div>
            <h1 className="text-5xl font-bold text-white mb-4">Make Your Own Templates</h1>
            <p className="text-xl text-purple-200 mb-6">
              Create story templates from scratch or start from a preset. Mint them as NFTs on Base.
            </p>

            <div className="text-purple-200 text-sm mb-8">
              Current Mint Price:&nbsp;
              <span className="font-semibold text-white">
                {mintPriceWei === 0n ? '—' : `${mintPriceEth.toFixed(5)} ETH`}
              </span>
              {usdApprox != null && (
                <span className="ml-2 opacity-80">(~${usdApprox.toFixed(2)} USD)</span>
              )}
            </div>

            {!isConnected ? (
              <div className="mb-8">
                <Button
                  onClick={connect}
                  disabled={walletLoading}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-3 px-6 rounded-lg"
                >
                  {walletLoading ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              </div>
            ) : (
              <div className="mb-8 bg-green-900/20 p-4 rounded-lg border border-green-500/30 max-w-md mx-auto">
                <p className="text-green-300 text-sm">
                  Connected: {address?.slice(0, 6)}…{address?.slice(-4)}
                </p>
                {!isOnBase && (
                  <div className="mt-3">
                    <Button onClick={switchToBase} className="bg-cyan-700 hover:bg-cyan-600 text-sm">
                      Switch to Base
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 pb-20">
          <Card className="bg-white/10 backdrop-blur border-purple-500/30">
            <CardHeader>
              <h2 className="text-3xl font-bold text-white text-center">Create Your Template</h2>
            </CardHeader>

            <CardContent className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 🔹 Preset Selector (left column) */}
                <div className="space-y-4">
                  <div className="text-white font-semibold">Start from a Preset</div>
                  <label className="block text-white text-sm font-medium mb-1">Category</label>
                  <select
                    value={catIdx}
                    onChange={(e) => { setCatIdx(Number(e.target.value)); setTmplIdx(0) }}
                    className="w-full px-3 py-2 rounded-lg bg-white/20 text-white border border-purple-300 focus:border-yellow-500 focus:outline-none"
                  >
                    {presetCategories.map((c, i) => (
                      <option key={c.name || i} value={i} className="bg-purple-900 text-white">
                        {c.name || `Category ${i + 1}`}
                      </option>
                    ))}
                  </select>

                  <label className="block text-white text-sm font-medium mb-1">Template</label>
                  <select
                    value={tmplIdx}
                    onChange={(e) => setTmplIdx(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white/20 text-white border border-purple-300 focus:border-yellow-500 focus:outline-none"
                  >
                    {currentTemplates.map((t, i) => (
                      <option key={t.id ?? i} value={i} className="bg-purple-900 text-white">
                        {(t.name || `Template ${i + 1}`)} ({t.blanks} blanks)
                      </option>
                    ))}
                  </select>

                  <Button
                    onClick={applyPreset}
                    className="w-full mt-2 bg-fuchsia-600 hover:bg-fuchsia-500"
                    type="button"
                  >
                    Use This Preset
                  </Button>

                  {currentPreset && (
                    <div className="text-purple-200 text-xs mt-2">
                      Parts: {currentPreset.parts.length} • Derived blanks: {currentPreset.blanks}
                    </div>
                  )}
                </div>

                {/* 📝 Form (middle column) */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Template Title</label>
                    <input
                      type="text"
                      value={templateTitle}
                      onChange={(e) => setTemplateTitle(e.target.value)}
                      placeholder="e.g., The Great Adventure"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-purple-300 focus:border-yellow-500 focus:outline-none"
                    />
                    <div className="text-xs text-purple-200 mt-1">{utf8BytesLen(templateTitle)} bytes</div>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Description</label>
                    <textarea
                      value={templateDesc}
                      onChange={(e) => setTemplateDesc(e.target.value)}
                      placeholder="Describe your template for the NFT metadata"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-purple-300 focus:border-yellow-500 focus:outline-none h-24 resize-none"
                    />
                    <div className="text-xs text-purple-200 mt-1">{utf8BytesLen(templateDesc)} bytes</div>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Theme</label>
                    <input
                      type="text"
                      value={templateTheme}
                      onChange={(e) => setTemplateTheme(e.target.value)}
                      placeholder="e.g., Space Adventure"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-purple-300 focus:border-yellow-500 focus:outline-none"
                    />
                    <div className="text-xs text-purple-200 mt-1">{utf8BytesLen(templateTheme)} bytes</div>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Story Parts</label>
                    <p className="text-purple-200 text-sm mb-3">Each gap between parts becomes a blank for players to fill.</p>
                    {storyParts.map((part, index) => (
                      <div key={index} className="mb-3 flex gap-2">
                        <textarea
                          value={part}
                          onChange={(e) => setStoryParts((p) => p.map((x, idx) => (idx === index ? e.target.value : x)))}
                          placeholder={`Story part ${index + 1}...`}
                          className="flex-1 px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-purple-300 focus:border-yellow-500 focus:outline-none h-24 resize-none"
                        />
                        {storyParts.length > 1 && (
                          <Button
                            onClick={() => setStoryParts((p) => p.filter((_, i) => i !== index))}
                            variant="outline"
                            className="px-3 py-1 text-red-300 border-red-300 hover:bg-red-500/20"
                            type="button"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <Button
                        onClick={() => setStoryParts((p) => [...p, ''])}
                        variant="outline"
                        className="py-2 border-dashed border-purple-400 text-purple-300 hover:border-yellow-500 hover:text-yellow-400"
                        type="button"
                      >
                        + Add Another Part
                      </Button>
                      <div className="text-xs text-purple-200">
                        Parts: {sanitizeParts(storyParts).length}/{maxParts} • Bytes in parts: {partsBytes}
                      </div>
                    </div>

                    <div className="text-xs text-purple-200 mt-2">
                      Total payload bytes (title + description + theme + parts): <b>{totalBytes}</b> / {maxTotalBytes}
                    </div>
                  </div>
                </div>

                {/* 👁️ Preview + Mint (right column) */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-white">Preview</h3>
                  <Card className="bg-white/5 border-purple-400/30">
                    <CardContent className="p-4">
                      <h4 className="text-white font-medium mb-1">{templateTitle || 'Your Template'}</h4>
                      <p className="text-purple-300 text-sm mb-2">{templateTheme || 'Theme'}</p>
                      <p className="text-purple-200 text-sm mb-3">{templateDesc || 'Short description for your NFT metadata'}</p>
                      <div className="space-y-2">
                        {sanitizeParts(storyParts).map((part, index, arr) => (
                          <p key={index} className="text-purple-200 leading-relaxed">
                            {part || <span className="text-purple-400 italic">Story part {index + 1}...</span>}
                            {index < arr.length - 1 && <span className="text-yellow-400 mx-2">[ blank ]</span>}
                          </p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handleMintTemplate}
                    disabled={
                      isLoading ||
                      !isConnected ||
                      !templateTitle ||
                      !templateDesc ||
                      !templateTheme ||
                      sanitizeParts(storyParts).length < 2 ||
                      mintPriceWei === 0n
                    }
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50"
                    type="button"
                  >
                    {isLoading
                      ? 'Minting NFT...'
                      : `Mint NFT Template (${mintPriceWei === 0n ? '—' : `${mintPriceEth.toFixed(5)} ETH`}${usdApprox != null ? ` ~ $${usdApprox.toFixed(2)}` : ''})`}
                  </Button>

                  {!isConnected && (
                    <p className="text-yellow-400 text-sm text-center">Connect your wallet to mint NFT templates</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
