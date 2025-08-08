'use client'

import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import clsx from 'clsx'
import { ethers } from 'ethers'
import NFT_ABI from '@/abi/MadFillTemplateNFT_ABI.json'

/** =========================
 *  Visual presets
 *  ========================= */
const defaultStickers = ['🐸', '💥', '🌈', '🧠', '🔥', '✨', '🌀', '🎉', '🍕', '👾']
const defaultTheme = 'retro'

const themes = {
  galaxy: {
    label: 'Galaxy',
    bg: 'bg-gradient-to-br from-indigo-900 to-purple-900',
    text: 'text-white',
  },
  tropical: {
    label: 'Tropical',
    bg: 'bg-gradient-to-br from-green-400 to-yellow-500',
    text: 'text-slate-900',
  },
  retro: {
    label: 'Retro',
    bg: 'bg-gradient-to-br from-pink-500 to-orange-400',
    text: 'text-slate-900',
  },
  parchment: {
    label: 'Parchment',
    bg: 'bg-[url("/parchment-texture.PNG")] bg-cover bg-center',
    text: 'text-slate-900',
  },
  clouds: {
    label: 'Clouds',
    bg: 'bg-[url("/clouds-texture.PNG")] bg-cover bg-center',
    text: 'text-slate-800',
  },
}

/** Helper to read the NFT contract address from env.
 *  Use NEXT_PUBLIC_ if present (client-exposed), else fallback to server var name.
 */
function getNftAddress() {
  return process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS || process.env.NFT_TEMPLATE_ADDRESS || ''
}

export default function MyoPage() {
  const [title, setTitle] = useState('My Epic MadFill')
  const [description, setDescription] = useState('A wild, weird, and fun round I created myself.')
  const [parts, setParts] = useState(['Today I ', '____', ' and then ', '____', ' while riding a ', '____', '!'])
  const [theme, setTheme] = useState(defaultTheme)
  const [stickers, setStickers] = useState(defaultStickers)
  const [activeSticker, setActiveSticker] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  // On-chain config (fetched)
  const [mintEth, setMintEth] = useState(null)       // number (ETH)
  const [royaltyBps, setRoyaltyBps] = useState(null) // number (bps)
  const [payoutWallet, setPayoutWallet] = useState('')

  // Contract limits (fetched)
  const [maxParts, setMaxParts] = useState(null)
  const [maxPartBytes, setMaxPartBytes] = useState(null)
  const [maxTotalBytes, setMaxTotalBytes] = useState(null)

  // UX state
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  // Load draft from localStorage
  useEffect(() => {
    const savedRaw = localStorage.getItem('madfill-myo-draft')
    if (!savedRaw) return
    try {
      const saved = JSON.parse(savedRaw)
      if (saved.title) setTitle(saved.title)
      if (saved.description) setDescription(saved.description)
      if (saved.parts) setParts(saved.parts)
      if (saved.theme) setTheme(saved.theme)
    } catch {}
  }, [])

  // Save draft
  useEffect(() => {
    localStorage.setItem(
      'madfill-myo-draft',
      JSON.stringify({ title, description, parts, theme })
    )
  }, [title, description, parts, theme])

  // Fetch mint price / royalty / payout + contract limits for validation
  useEffect(() => {
    const addr = getNftAddress()
    if (!addr) return
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(addr, NFT_ABI, provider)

        const [wei, bps, wallet, _maxParts, _maxPartBytes, _maxTotalBytes] =
          await Promise.all([
            ct.getMintPriceWei(),
            ct.DEFAULT_ROYALTY_BPS(),
            ct.payoutWallet(),
            ct.MAX_PARTS(),
            ct.MAX_PART_BYTES(),
            ct.MAX_TOTAL_BYTES(),
          ])

        setMintEth(Number(ethers.formatEther(wei)))
        setRoyaltyBps(Number(bps))
        setPayoutWallet(wallet)
        setMaxParts(Number(_maxParts))
        setMaxPartBytes(Number(_maxPartBytes))
        setMaxTotalBytes(Number(_maxTotalBytes))
      } catch (err) {
        console.warn('Failed to load NFT settings:', err)
      }
    })()
  }, [])

  /** =========================
   *  Editing helpers
   *  ========================= */
  const handlePartChange = (value, i) => {
    const newParts = [...parts]
    newParts[i] = value
    setParts(newParts)
  }

  const addBlank = () => setParts([...parts, '____'])
  const addTextPart = () => setParts([...parts, ''])

  const toggleSticker = (emoji) => {
    setActiveSticker((prev) => (prev === emoji ? null : emoji))
  }

  const addStickerToEnd = () => {
    if (activeSticker) {
      setParts([...parts, activeSticker])
      setActiveSticker(null)
    }
  }

  const randomizeTheme = () => {
    const keys = Object.keys(themes)
    const pick = keys[Math.floor(Math.random() * keys.length)]
    setTheme(pick)
  }

  /** =========================
   *  Validation (client-side to match contract guards)
   *  ========================= */
  function utf8BytesLength(str) {
    // quick & safe byte-length for UTF-8
    return new TextEncoder().encode(str || '').length
  }

  function validateTemplate() {
    if (!title?.trim()) return 'Please add a title.'
    if (!description?.trim()) return 'Please add a short description.'
    if (!theme || !themes[theme]) return 'Please pick a theme.'

    const _maxParts = maxParts ?? 16
    const _maxPartBytes = maxPartBytes ?? 80
    const _maxTotalBytes = maxTotalBytes ?? 1024

    if (parts.length === 0) return 'Add some parts to your template.'
    if (parts.length > _maxParts) return `Too many parts (max ${_maxParts}).`

    let total = 0
    for (let i = 0; i < parts.length; i++) {
      const b = utf8BytesLength(parts[i])
      if (b > _maxPartBytes) return `Part #${i + 1} is too long (max ${_maxPartBytes} bytes).`
      total += b
    }
    if (total > _maxTotalBytes) return `Template too large (max ${_maxTotalBytes} bytes total).`

    // Encourage at least one blank
    const hasBlank = parts.some(p => p === '____')
    if (!hasBlank) return 'Add at least one blank "____" for people to fill!'

    return null
  }

  /** =========================
   *  Mint
   *  ========================= */
  async function mintTemplate() {
    setStatus('')
    const error = validateTemplate()
    if (error) {
      setStatus('❌ ' + error)
      return
    }

    const addr = getNftAddress()
    if (!addr) {
      setStatus('❌ NFT contract address not configured.')
      return
    }

    if (!window.ethereum) {
      setStatus('❌ No wallet detected.')
      return
    }

    try {
      setBusy(true)
      setStatus('⏳ Fetching mint price…')

      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      const signer = await browserProvider.getSigner()
      const ct = new ethers.Contract(addr, NFT_ABI, signer)

      // get latest mint price in wei from contract (on-chain USD conversion)
      const priceWei = await ct.getMintPriceWei()
      const buffer = (priceWei * 1005n) / 1000n // +0.5% buffer to avoid rounding failures

      setStatus('🧪 Sending mint…')

      const tx = await ct.mintTemplate(title.trim(), description.trim(), theme, parts, {
        value: buffer,
      })
      setStatus('⛏️ Minting… waiting for confirmation')
      const r = await tx.wait()

      // Try to find a Minted event to show tokenId (optional—depends on your contract’s event index)
      let tokenIdStr = null
      try {
        const minted = r.logs
          ?.map(l => {
            try { return ct.interface.parseLog(l) } catch { return null }
          })
          ?.find(ev => ev && ev.name === 'Minted')
        if (minted) tokenIdStr = minted.args?.tokenId?.toString?.()
      } catch {}

      setStatus(`✅ Minted! ${tokenIdStr ? `Token #${tokenIdStr}` : ''} View in your wallet.`)
    } catch (err) {
      console.error(err)
      const msg = err?.shortMessage || err?.reason || err?.message || 'Mint failed'
      setStatus('❌ ' + msg.split('\n')[0])
    } finally {
      setBusy(false)
    }
  }

  /** =========================
   *  Share links
   *  ========================= */
  const shareText = encodeURIComponent(
    `🧠 I made a custom MadFill!\n\n${parts.join(' ')}\n\nTry it here: https://madfill.vercel.app/myo`
  )
  const farcasterShare = `https://warpcast.com/~/compose?text=${shareText}`
  const twitterShare = `https://twitter.com/intent/tweet?text=${shareText}`

  /** =========================
   *  Render
   *  ========================= */
  return (
    <Layout>
      <div className="rounded-xl shadow-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6">
        {/* Header + Fun explainer card */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold">🎨 Make Your Own MadFill</h2>
            <p className="text-sm text-indigo-300">
              Build your own weird sentence + style — then **mint it** as an NFT so others can remix it forever.
            </p>
          </div>

          {/* Info / Fees / How it works */}
          <div className="rounded-xl border border-indigo-700 bg-slate-900/60 p-4">
            <p className="font-semibold mb-1">ℹ️ How this page works</p>
            <ul className="list-disc ml-5 text-sm space-y-1 text-slate-200">
              <li>Type your sentence parts — use <span className="px-1 rounded bg-slate-800 text-pink-300">____</span> wherever you want players to fill in.</li>
              <li>Pick a theme, toss in stickers, and preview anytime.</li>
              <li>Hit <b>Mint Template</b> to save it on-chain as a collectible + reusable game card.</li>
            </ul>

            <div className="h-px my-3 bg-slate-700" />

            <p className="font-semibold mb-1">💸 Transparent fees</p>
            <div className="text-xs grid gap-1">
              <div className="inline-flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                  💎 {mintEth != null ? `~${mintEth.toFixed(5)} ETH` : 'Loading…'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                  🎧 Royalties {royaltyBps != null ? `${(royaltyBps / 100).toFixed(2)}%` : '…'}
                </span>
                {payoutWallet && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                    🏦 {payoutWallet.slice(0, 6)}…{payoutWallet.slice(-4)}
                  </span>
                )}
              </div>
              <p className="text-slate-400">
                Price auto-converts from USD (on-chain oracle). You pay gas + mint price. Royalties apply on secondary sales.
              </p>
            </div>
          </div>
        </div>

        {/* Title / Description */}
        <label className="block text-sm font-medium">Title</label>
        <input
          className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 mb-4"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
        />

        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 mb-4"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={240}
        />

        {/* Theme + stickers */}
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <label className="text-sm font-medium">Theme</label>
          <select
            className="bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            {Object.entries(themes).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <Button onClick={randomizeTheme} className="bg-purple-600 hover:bg-purple-500 ml-auto">🎲 Randomize</Button>
        </div>

        <div className="mb-4">
          <p className="text-sm font-medium mb-1">🖼️ Stickers (click to select, then “Add to End”)</p>
          <div className="flex gap-2 flex-wrap">
            {stickers.map((s, i) => (
              <button
                key={i}
                onClick={() => toggleSticker(s)}
                className={`text-xl p-2 rounded ${activeSticker === s ? 'bg-indigo-700 scale-110' : 'bg-slate-800 hover:bg-slate-700'}`}
                title="Click to select"
              >
                {s}
              </button>
            ))}
            <button
              onClick={addStickerToEnd}
              className="text-sm px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              + Add to End
            </button>
          </div>
        </div>

        {/* Parts */}
        <div className="space-y-2 mb-4">
          {parts.map((part, i) => (
            <input
              key={i}
              value={part}
              onChange={(e) => handlePartChange(e.target.value, i)}
              className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
              placeholder={i % 2 ? '____' : 'Write some text…'}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <Button onClick={addBlank} className="bg-pink-600 hover:bg-pink-500">+ Add Blank</Button>
          <Button onClick={addTextPart} className="bg-slate-700 hover:bg-slate-600">+ Add Text</Button>
          <Button onClick={() => setShowPreview(true)} className="bg-indigo-600 hover:bg-indigo-500">👀 Preview Template</Button>
        </div>

        {/* Live styled preview box */}
        <div className={clsx("p-6 rounded-xl font-mono text-sm border border-slate-700", themes[theme].bg, themes[theme].text)}>
          <p className="text-lg font-bold mb-2">{title}</p>
          <p className="space-x-1">
            {parts.map((p, i) => (
              <span key={i} className={p === '____' ? 'text-pink-300 underline' : ''}>{p || ' '}</span>
            ))}
          </p>
        </div>

        {/* Action Row */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <Button
            onClick={mintTemplate}
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            {busy ? '⛏️ Minting…' : '🪙 Mint Template'}
          </Button>

          {/* Status pill (live numbers) */}
          <div className="flex-1">
            {mintEth != null && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200">
                <span>💎 ~{mintEth.toFixed(5)} ETH</span>
                <span>•</span>
                <span>🎧 Royalties {(royaltyBps / 100).toFixed(2)}%</span>
                {payoutWallet && (
                  <>
                    <span>•</span>
                    <span>🏦 {payoutWallet.slice(0, 6)}…{payoutWallet.slice(-4)}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Share */}
          <div className="flex gap-2">
            <a
              href={farcasterShare}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-white text-sm"
            >
              🌀 Share
            </a>
            <a
              href={twitterShare}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white text-sm"
            >
              🐦 Tweet
            </a>
          </div>
        </div>

        {status && (
          <div className={clsx(
            'mt-4 rounded border px-3 py-2 text-sm',
            status.startsWith('✅') ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200' :
            status.startsWith('⏳') || status.startsWith('🧪') || status.startsWith('⛏️') ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200' :
            'border-rose-500 bg-rose-500/10 text-rose-200'
          )}>
            {status}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className={clsx("max-w-md w-full p-6 rounded-xl relative shadow-2xl", themes[theme].bg, themes[theme].text)}>
            <button onClick={() => setShowPreview(false)} className="absolute top-2 right-3 text-xl">✖️</button>
            <h3 className="text-2xl font-bold mb-2">{title}</h3>
            <p className="text-sm opacity-90 mb-4 italic">{description}</p>
            <div className="font-mono text-base space-x-1">
              {parts.map((p, i) => (
                <span key={i} className={p === '____' ? 'text-pink-200 underline' : ''}>{p || ' '}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
