'use client'
import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import clsx from 'clsx'
import { ethers } from 'ethers'
import NFT_ABI from '@/abi/MadFillTemplateNFT_ABI.json'

const defaultStickers = ['🐸', '💥', '🌈', '🧠', '🔥', '✨', '🌀', '🎉', '🍕', '👾']
const defaultTheme = 'retro'

const themes = {
  galaxy: { label: 'Galaxy', bg: 'bg-gradient-to-br from-indigo-900 to-purple-900', text: 'text-white' },
  tropical: { label: 'Tropical', bg: 'bg-gradient-to-br from-green-400 to-yellow-500', text: 'text-slate-900' },
  retro: { label: 'Retro', bg: 'bg-gradient-to-br from-pink-500 to-orange-400', text: 'text-slate-900' },
  parchment: { label: 'Parchment', bg: 'bg-[url("/parchment-texture.PNG")] bg-cover bg-center', text: 'text-slate-900' },
  clouds: { label: 'Clouds', bg: 'bg-[url("/clouds-texture.PNG")] bg-cover bg-center', text: 'text-slate-800' }
}

export default function MyoPage() {
  const [title, setTitle] = useState('My Epic MadFill')
  const [description, setDescription] = useState('A wild, weird, and fun round I created myself.')
  const [parts, setParts] = useState(['Today I ', '____', ' and then ', '____', ' while riding a ', '____', '!'])
  const [theme, setTheme] = useState(defaultTheme)
  const [stickers, setStickers] = useState(defaultStickers)
  const [activeSticker, setActiveSticker] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  const [mintPriceWei, setMintPriceWei] = useState(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [address, setAddress] = useState(null)

  const nftAddress = process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS || process.env.NFT_TEMPLATE_ADDRESS

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('madfill-myo-draft') || '{}')
    if (saved.title) setTitle(saved.title)
    if (saved.description) setDescription(saved.description)
    if (saved.parts) setParts(saved.parts)
    if (saved.theme) setTheme(saved.theme)
  }, [])

  useEffect(() => {
    localStorage.setItem('madfill-myo-draft', JSON.stringify({ title, description, parts, theme }))
  }, [title, description, parts, theme])

  useEffect(() => {
    // read price from NFT contract (public view price())
    ;(async () => {
      try {
        if (!nftAddress) return
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(nftAddress, NFT_ABI, provider)
        const p = await ct.price()
        setMintPriceWei(p)
      } catch (e) {
        // fallback to $1 in wei guess if price() is missing – but prefer real on-chain price
        setMintPriceWei(ethers.parseEther('0.0005')) // ~ placeholder
      }
    })()
  }, [nftAddress])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum?.selectedAddress) {
      setAddress(window.ethereum.selectedAddress)
    }
  }, [])

  function addBlank() {
    setParts([...parts, '____'])
  }
  function addTextPart() {
    setParts([...parts, ''])
  }
  function handlePartChange(value, i) {
    const next = [...parts]
    next[i] = value
    setParts(next)
  }
  function toggleSticker(emoji) {
    setActiveSticker(prev => (prev === emoji ? null : emoji))
  }
  function addStickerToEnd() {
    if (activeSticker) {
      setParts([...parts, activeSticker])
      setActiveSticker(null)
    }
  }
  function randomizeTheme() {
    const keys = Object.keys(themes)
    setTheme(keys[Math.floor(Math.random() * keys.length)])
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) throw new Error('No wallet found')
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAddress(accounts?.[0] || null)

      // ensure Base
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }] // Base mainnet
      })
    } catch (e) {
      setStatus('Connect failed: ' + (e?.message || 'unknown'))
    }
  }

  function validate() {
    if (!title.trim()) return 'Title required'
    if (title.length > 64) return 'Title too long (max 64)'
    if (description.length > 280) return 'Description too long (max 280)'
    if (!Array.isArray(parts) || parts.length < 1) return 'Add at least one part'
    // gentle guard: at least one blank recommended
    const hasBlank = parts.some(p => p === '____')
    if (!hasBlank) return 'Add at least one "____" blank'
    return ''
  }

  async function handleMint() {
    const err = validate()
    if (err) {
      setStatus('❌ ' + err)
      return
    }
    if (!nftAddress) {
      setStatus('❌ Missing NFT contract address (set NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS)')
      return
    }
    try {
      setBusy(true)
      setStatus('Connecting wallet...')
      if (!address) await connectWallet()

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(nftAddress, NFT_ABI, signer)

      // fetch live price (if available)
      let value = mintPriceWei
      try {
        const p = await ct.price()
        if (p && p > 0n) value = p
      } catch {}
      if (!value) throw new Error('Could not determine mint price')

      setStatus('Minting your template NFT...')
      const tx = await ct.mintTemplate(title.trim(), description.trim(), parts, theme, { value })
      setTxHash(tx.hash)
      await tx.wait()

      setStatus('✅ Minted! View on BaseScan or your wallet.')
    } catch (e) {
      const msg = (e?.shortMessage || e?.message || 'Mint failed').split('\n')[0]
      setStatus('❌ ' + msg)
    } finally {
      setBusy(false)
    }
  }

  const priceEth = mintPriceWei ? Number(ethers.formatEther(mintPriceWei)) : null

  const shareText = encodeURIComponent(
    `I just designed a custom MadFill template! Minted as an NFT on Base.\nTitle: ${title}\nTry builder: https://madfill.vercel.app/myo`
  )

  return (
    <Layout>
      <div className="rounded-xl shadow-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold">Create & Mint Your Own Template</h2>
          <p className="text-sm text-indigo-300">Build the sentence, style it, then mint to the chain.</p>
        </div>

        {status && (
          <div className="mb-4 text-sm rounded bg-slate-800 border border-slate-700 px-3 py-2">
            {status} {txHash ? (
              <a
                className="underline text-indigo-300 ml-2"
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View tx
              </a>
            ) : null}
          </div>
        )}

        <label className="block text-sm font-medium">Title</label>
        <input
          className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 mb-4"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={64}
        />

        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 mb-4"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={280}
        />

        <div className="flex gap-2 items-center mb-4">
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
          <Button onClick={randomizeTheme} className="bg-purple-600 hover:bg-purple-500 ml-auto">
            Randomize
          </Button>
        </div>

        <div className="mb-4">
          <p className="text-sm font-medium mb-1">Stickers (click to select, then "Add to End")</p>
          <div className="flex gap-2 flex-wrap">
            {stickers.map((s, i) => (
              <button
                key={i}
                onClick={() => toggleSticker(s)}
                className={`text-xl p-2 rounded ${activeSticker === s ? 'bg-indigo-700 scale-110' : 'bg-slate-800 hover:bg-slate-700'}`}
              >
                {s}
              </button>
            ))}
            <button onClick={addStickerToEnd} className="text-sm px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white">
              + Add to End
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {parts.map((part, i) => (
            <input
              key={i}
              value={part}
              onChange={(e) => handlePartChange(e.target.value, i)}
              className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2"
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <Button onClick={addBlank} className="bg-pink-600 hover:bg-pink-500">+ Add Blank</Button>
          <Button onClick={addTextPart} className="bg-slate-700 hover:bg-slate-600">+ Add Text</Button>
          <Button onClick={() => setShowPreview(true)} className="bg-indigo-600 hover:bg-indigo-500">Preview</Button>
        </div>

        {/* Mint info card */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className={clsx('p-4 rounded-xl border border-slate-700', themes[theme].bg, themes[theme].text)}>
            <p className="text-lg font-bold mb-2">{title}</p>
            <p className="text-sm opacity-80 mb-3">{description}</p>
            <div className="font-mono text-sm space-x-1">
              {parts.map((p, i) => (
                <span key={i} className={p === '____' ? 'text-pink-300 underline' : ''}>{p || ' '}</span>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-700 bg-slate-900">
            <h3 className="font-semibold mb-1">Mint details</h3>
            <ul className="text-sm space-y-1 text-slate-300">
              <li>• Network: Base</li>
              <li>• Contract: {nftAddress || 'Not set'}</li>
              <li>• Price: {priceEth != null ? `${priceEth} ETH` : 'loading...'}</li>
              <li>• Fee: 0.5% protocol, the rest to prize ecosystem</li>
            </ul>
            <Button
              onClick={handleMint}
              disabled={busy || !nftAddress}
              className="mt-3 bg-green-600 hover:bg-green-500"
            >
              {busy ? 'Minting...' : 'Mint Template NFT'}
            </Button>

            <div className="mt-3 text-xs text-slate-400">
              Tip: Keep your parts short and punchy. Include at least one "____" so players can fill it in.
            </div>
          </div>
        </div>

        <div className="text-center space-y-2">
          <div className="flex justify-center gap-3">
            <a
              href={`https://warpcast.com/~/compose?text=${shareText}`}
              target="_blank"
              className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-white"
            >
              Share
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}`}
              target="_blank"
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white"
            >
              Tweet
            </a>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center px-4">
          <div className={clsx('max-w-md w-full p-6 rounded-xl relative shadow-2xl', themes[theme].bg, themes[theme].text)}>
            <button onClick={() => setShowPreview(false)} className="absolute top-2 right-3 text-xl">✖</button>
            <h3 className="text-2xl font-bold mb-2">{title}</h3>
            <p className="text-sm opacity-80 mb-4 italic">{description}</p>
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
