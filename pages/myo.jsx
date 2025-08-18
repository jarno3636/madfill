// pages/myo.jsx
'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
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

/* ---------- utils ---------- */
const stripWeird = (s) => String(s || '').replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width etc
const bytes = (s) => new TextEncoder().encode(stripWeird(s)).length
const isNonEmpty = (s) => !!String(s || '').trim()

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

/* ---------- minimal read ABI (defensive; all optional) ---------- */
const TEMPLATE_READ_ABI = [
  { inputs: [], name: 'BLANK', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_PARTS', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_PART_BYTES', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MAX_TOTAL_BYTES', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getMintPriceWei', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'paused', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
]

/** Build preview parts (implicit blanks) + contract parts (explicit BLANK tokens). */
function computeParts(rawStory, rawFills, blankToken) {
  const story = stripWeird(rawStory)
  const fills = (rawFills || []).map(stripWeird)

  const chunks = story.split(/\[BLANK\]/g)
  const blanks = Math.max(0, chunks.length - 1)
  const safeFills = Array.from({ length: blanks }, (_, i) => (fills?.[i] || '').trim())

  // PREVIEW: merge filled; split on unfilled
  const preview = [chunks[0] || '']
  for (let i = 0; i < blanks; i++) {
    const fill = safeFills[i]
    const nextText = chunks[i + 1] || ''
    if (fill) preview[preview.length - 1] = preview[preview.length - 1] + fill + nextText
    else preview.push(nextText)
  }

  // CONTRACT PARTS: alternate text / BLANK / text; no leading/trailing BLANK; collapse empties
  const parts = []
  const pushText = (t) => {
    const s = stripWeird(t)
    if (!s) return
    if (parts.length === 0) parts.push(s)
    else if (parts[parts.length - 1] === blankToken) parts.push(s)
    else parts[parts.length - 1] = parts[parts.length - 1] + s
  }
  const pushBlank = () => {
    if (parts.length === 0) return
    if (parts[parts.length - 1] !== blankToken) parts.push(blankToken)
  }

  pushText(chunks[0])
  for (let i = 0; i < blanks; i++) {
    const fill = safeFills[i]
    const nextText = chunks[i + 1] || ''
    if (fill) { pushText(fill); pushText(nextText) }
    else { pushBlank(); pushText(nextText) }
  }
  if (parts[parts.length - 1] === blankToken) parts.pop()

  // Ensure at least one BLANK remains for the template contract
  if (!parts.includes(blankToken)) {
    if (parts.length === 1) parts.push(blankToken, ' ')
    else parts.splice(1, 0, blankToken)
  }

  const blankCount = parts.filter((p) => p === blankToken).length
  const textPartsForContract = parts.filter((p) => p !== blankToken)

  return {
    partsForContract: parts,
    partsForPreview: preview,
    textPartsForContract,
    blankCount,
  }
}

/* ---------- tx status helpers ---------- */
const SOFT_ERROR_TEXTS = [
  'coalesce', 'replacement transaction', 'repriced', 'failed to fetch', 'nonce has already been used'
]
const isSoftError = (msg='') => SOFT_ERROR_TEXTS.some(s => (msg || '').toLowerCase().includes(s))

const TOPIC_MINTED = ethers.id('Minted(uint256,address,string,string)')

const Spinner = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent align-middle" />
)

export default function MYOPage() {
  useMiniAppReady()
  const { addToast } = useToast()
  const { width, height } = useWindowSize()

  const {
    isConnected, connect, isOnBase,
    BASE_RPC, NFT_ADDRESS,
    mintTemplateNFT,
    address,
  } = useTx()

  // limits/state
  const [maxParts, setMaxParts] = useState(24)
  const [maxPartBytes, setMaxPartBytes] = useState(96)
  const [maxTotalBytes, setMaxTotalBytes] = useState(4096)
  const [paused, setPaused] = useState(false)

  // BLANK token from contract (default placeholder)
  const [blankToken, setBlankToken] = useState('[BLANK]')

  // Display-only fee text; actual fee pulled on mint
  const DISPLAY_FEE_WEI = (() => {
    try { return ethers.parseEther('0.0005') } catch { return 500000000000000n }
  })()
  const DISPLAY_FEE_ETH = Number(ethers.formatEther(DISPLAY_FEE_WEI)).toFixed(6)

  // ui
  const [loading, setLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  // tx status bar
  const [txStatus, setTxStatus] = useState('')       // human text
  const [txError, setTxError] = useState('')         // error text if any
  const [txHash, setTxHash] = useState(null)         // last tx hash
  const [verifying, setVerifying] = useState(false)  // soft-error verification toggle

  // meta
  const [title, setTitle] = useState('')
  const [theme, setTheme] = useState('')
  const [description, setDescription] = useState('')

  // debug
  const [showDebug, setShowDebug] = useState(false)

  // story + fills
  const storyRef = useRef(null)
  const [story, setStory] = useState(PROMPT_STARTERS[0])
  const blanksInStory = useMemo(
    () => Math.max(0, stripWeird(story).split(/\[BLANK\]/g).length - 1),
    [story]
  )
  const [fills, setFills] = useState(Array(blanksInStory).fill(''))

  // background
  const [bgKey, setBgKey] = useState(BG_CHOICES[0].key)

  // keep fills aligned
  useEffect(() => {
    setFills((prev) => {
      const next = Array(blanksInStory).fill('')
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i]
      return next
    })
  }, [blanksInStory])

  // safe reads for limits + BLANK + paused
  useEffect(() => {
    if (!NFT_ADDRESS) return
    const provider = new ethers.JsonRpcProvider(BASE_RPC)
    const ct = new ethers.Contract(NFT_ADDRESS, TEMPLATE_READ_ABI, provider)
    let alive = true

    const pull = async () => {
      try {
        const [blk, mp, mpb, mtb, isPaused] = await Promise.all([
          ct.BLANK().catch(() => '[BLANK]'),
          ct.MAX_PARTS().catch(() => null),
          ct.MAX_PART_BYTES().catch(() => null),
          ct.MAX_TOTAL_BYTES().catch(() => null),
          ct.paused().catch(() => false),
        ])
        if (!alive) return
        setBlankToken(String(blk || '[BLANK]'))
        if (mp && mp > 0n) setMaxParts(Number(mp))
        if (mpb && mpb > 0n) setMaxPartBytes(Number(mpb))
        if (mtb && mtb > 0n) setMaxTotalBytes(Number(mtb))
        setPaused(Boolean(isPaused))
      } catch {
        if (!alive) return
        setBlankToken('[BLANK]')
      }
    }

    pull()
    const id = setInterval(pull, 60_000)
    const onVis = () => { if (document.visibilityState === 'visible') pull() }
    document.addEventListener('visibilitychange', onVis)

    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [BASE_RPC, NFT_ADDRESS])

  // derive parts + sizes FROM CONTRACT PERSPECTIVE
  const {
    partsForContract,
    partsForPreview,
    textPartsForContract,
    blankCount,
  } = useMemo(
    () => computeParts(story, fills, blankToken),
    [story, fills, blankToken]
  )

  // Bytes that matter to the contract: ONLY text parts (no BLANK tokens)
  const contractTextBytes = useMemo(
    () => textPartsForContract.reduce((sum, p) => sum + bytes(p), 0),
    [textPartsForContract]
  )

  // Total metadata bytes enforced by contract (title/desc/theme + text bytes)
  const totalContractBytes = bytes(title) + bytes(description) + bytes(theme) + contractTextBytes

  // bg class
  const bgCls = useMemo(
    () => (BG_CHOICES.find((b) => b.key === bgKey) || BG_CHOICES[0]).cls,
    [bgKey]
  )

  // editor helpers
  const insertBlankAtCursor = () => {
    const el = storyRef.current
    const token = '[BLANK]'
    if (!el) { setStory((s) => `${s}${s.endsWith(' ') ? '' : ' '}${token} `); return }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const before = story.slice(0, start)
    const after = story.slice(end)
    const next = `${before}${token}${after}`
    setStory(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const randomizeStarter = () => {
    const pick = PROMPT_STARTERS[Math.floor(Math.random() * PROMPT_STARTERS.length)]
    setStory(pick)
    setFills([]) // resizes via effect
  }
  const randomizeBackground = () => {
    const idx = BG_CHOICES.findIndex((b) => b.key === bgKey)
    const next = (idx + 1) % BG_CHOICES.length
    setBgKey(BG_CHOICES[next].key)
  }

  // PRE-FLIGHT CHECKS (explicit reasons)
  const reasonsCantMint = useMemo(() => {
    const reasons = []
    if (!NFT_ADDRESS) reasons.push('Missing NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS')
    if (!isConnected) reasons.push('Wallet not connected')
    if (!isOnBase) reasons.push('Wrong network: switch to Base (8453)')
    if (paused) reasons.push('Minting is paused')
    if (!isNonEmpty(title)) reasons.push('Title is required')
    if (!isNonEmpty(theme)) reasons.push('Theme is required')
    if (!isNonEmpty(description)) reasons.push('Description is required')
    if (partsForContract.length > maxParts) reasons.push(`Too many parts (${partsForContract.length}/${maxParts})`)
    if (textPartsForContract.some((p) => bytes(p) > maxPartBytes)) reasons.push(`A text part exceeds ${maxPartBytes} bytes`)
    if (totalContractBytes > maxTotalBytes) reasons.push(`Total bytes exceed ${maxTotalBytes}`)
    if (blankCount < 1) reasons.push('Leave at least one [BLANK] unfilled')
    if (typeof mintTemplateNFT !== 'function') reasons.push('mintTemplateNFT is not available from useTx()')
    return reasons
  }, [
    NFT_ADDRESS, isConnected, isOnBase, paused,
    title, theme, description,
    partsForContract.length, maxParts,
    textPartsForContract, maxPartBytes,
    totalContractBytes, maxTotalBytes,
    blankCount, mintTemplateNFT
  ])

  const canMint =
    reasonsCantMint.length === 0 && !loading

  // exact on-chain mint fee (contract expects exact value)
  const readMintFeeExact = useCallback(async () => {
    if (!NFT_ADDRESS) return DISPLAY_FEE_WEI
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC)
      const ct = new ethers.Contract(NFT_ADDRESS, TEMPLATE_READ_ABI, provider)
      const onchain = await ct.getMintPriceWei().catch(() => 0n)
      return (onchain && onchain > 0n) ? onchain : DISPLAY_FEE_WEI
    } catch {
      return DISPLAY_FEE_WEI
    }
  }, [BASE_RPC, NFT_ADDRESS])

  /* ---------- helpers: provider + wait + verification ---------- */
  const provider = useMemo(() => new ethers.JsonRpcProvider(BASE_RPC), [BASE_RPC])

  async function waitForReceipt(hash, timeoutMs = 35000) {
    try {
      const rec = await provider.waitForTransaction(hash, 1, timeoutMs)
      return rec?.status === 1
    } catch { return false }
  }

  async function verifyMintedOnChain({ contractAddr, lookback = 3000 }) {
    try {
      const latest = await provider.getBlockNumber()
      const fromBlock = Math.max(0, latest - lookback)
      const logs = await provider.getLogs({
        address: contractAddr,
        fromBlock,
        toBlock: latest,
        topics: [TOPIC_MINTED],
      })
      return (logs && logs.length > 0)
    } catch { return false }
  }

  function clearStatusSoon() {
    setTimeout(() => { setTxStatus(''); setTxError('') }, 3000)
  }

  // ENSURE WALLET PROMPT (requests accounts if connected flag lies / embeds)
  const ensureWalletPrompt = useCallback(async () => {
    const eth = globalThis?.ethereum || (globalThis?.window && window.ethereum)
    if (!eth) {
      addToast({ type: 'error', title: 'No Wallet', message: 'No injected wallet found (window.ethereum).' })
      return false
    }
    try {
      // request accounts to force UI prompt if needed
      await eth.request({ method: 'eth_requestAccounts' })
      // optionally check chain and suggest switch
      const ch = await eth.request({ method: 'eth_chainId' })
      if (ch !== '0x2105') { // 8453
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
          })
        } catch (e) {
          addToast({ type: 'error', title: 'Wrong Network', message: 'Please switch to Base (8453).' })
          return false
        }
      }
      return true
    } catch (e) {
      addToast({ type: 'error', title: 'Wallet Error', message: e?.message || 'Could not access wallet.' })
      return false
    }
  }, [addToast])

  // mint (with soft error + verification + tiny fee-bump retry)
  const handleMint = useCallback(async () => {
    // if disabled, surface the first reason immediately
    if (!canMint) {
      if (reasonsCantMint.length) {
        addToast({ type: 'error', title: 'Can’t Mint', message: reasonsCantMint[0] })
      }
      return
    }

    // double-check wallet prompt (helps if embedded)
    const walletOk = await ensureWalletPrompt()
    if (!walletOk) return

    setTxError('')
    setTxStatus('')
    setTxHash(null)
    setVerifying(false)

    try {
      setLoading(true)
      setTxStatus('Waiting for wallet confirmation…')

      const valueWei = await readMintFeeExact()

      if (typeof mintTemplateNFT !== 'function') {
        throw new Error('mintTemplateNFT function is missing from useTx().')
      }

      let res = await mintTemplateNFT(
        String(title).slice(0, 128),
        String(description).slice(0, 2048),
        String(theme).slice(0, 128),
        partsForContract,
        { value: valueWei }
      )

      const hash =
        res?.hash ||
        res?.transactionHash ||
        (typeof res === 'string' && res.startsWith('0x') ? res : null)

      if (hash) setTxHash(hash)
      setTxStatus('Submitting transaction…')

      let success = false
      if (hash) {
        success = await waitForReceipt(hash, 35000)
      }

      if (!success) {
        setVerifying(true)
        setTxStatus('Verifying on-chain…')
        const ok = await verifyMintedOnChain({ contractAddr: NFT_ADDRESS })
        success = ok
      }

      if (success) {
        addToast({ type: 'success', title: 'Template Minted!', message: 'Your template NFT is live.' })
        setTxStatus('Minted ✓')
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 1600)

        // reset (keep background)
        setTitle(''); setTheme(''); setDescription('')
        setStory(PROMPT_STARTERS[Math.floor(Math.random() * PROMPT_STARTERS.length)])
        setFills([])

        clearStatusSoon()
      } else {
        setTxError('We could not confirm the mint. Please check your wallet activity or Basescan.')
        setTxStatus('Not confirmed')
      }
    } catch (e) {
      console.error(e)
      const msg =
        e?.info?.error?.message ||
        e?.shortMessage ||
        e?.reason ||
        e?.message ||
        'Transaction failed.'

      if (isSoftError(msg)) {
        setVerifying(true)
        setTxStatus('Network hiccup. Verifying on-chain…')
        const ok = await verifyMintedOnChain({ contractAddr: NFT_ADDRESS })
        if (ok) {
          addToast({ type: 'success', title: 'Template Minted!', message: 'Your template NFT is live.' })
          setTxStatus('Minted ✓')
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 1600)
          setTxError('')
          clearStatusSoon()
          setLoading(false)
          setVerifying(false)

          setTitle(''); setTheme(''); setDescription('')
          setStory(PROMPT_STARTERS[Math.floor(Math.random() * PROMPT_STARTERS.length)])
          setFills([])
          return
        }
      }

      if (/insufficient funds|underpriced|fee|price/i.test(msg)) {
        try {
          setTxStatus('Retrying with adjusted value…')
          const exact = await readMintFeeExact()
          const bump = exact + (exact / 100n) // +1%
          const retry = await mintTemplateNFT(
            String(title).slice(0, 128),
            String(description).slice(0, 2048),
            String(theme).slice(0, 128),
            partsForContract,
            { value: bump }
          )
          const retryHash = retry?.hash || retry?.transactionHash
          if (retryHash) setTxHash(retryHash)
          const ok = retryHash ? await waitForReceipt(retryHash, 35000) : false
          if (ok) {
            addToast({ type: 'success', title: 'Template Minted!', message: 'Your template NFT is live.' })
            setTxStatus('Minted ✓')
            setTxError('')
            setShowConfetti(true)
            setTimeout(() => setShowConfetti(false), 1600)
            setTitle(''); setTheme(''); setDescription('')
            setStory(PROMPT_STARTERS[Math.floor(Math.random() * PROMPT_STARTERS.length)])
            setFills([])
            clearStatusSoon()
            return
          }
        } catch {}
      }

      if (/execution reverted|no data/i.test(msg)) {
        addToast({
          type: 'error',
          title: 'Mint Reverted',
          message: 'Likely over a limit, wrong parts shape, or no BLANK left. Check bytes/parts and ensure at least one BLANK.',
        })
      } else {
        addToast({ type: 'error', title: 'Mint Failed', message: msg })
      }
      setTxError(msg)
      setTxStatus('Mint failed')
      setShowConfetti(false)
    } finally {
      setLoading(false)
      setVerifying(false)
    }
  }, [
    canMint, reasonsCantMint, ensureWalletPrompt,
    readMintFeeExact, mintTemplateNFT,
    title, description, theme, partsForContract,
    addToast, NFT_ADDRESS
  ])

  const wordsForPreview = useMemo(() => {
    const w = {}
    for (let i = 0; i < blankCount; i++) w[i] = ''
    return w
  }, [blankCount])

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

      {/* Inline TX status bar (prominent, with Basescan link) */}
      {(txStatus || txError) && (
        <div className="mx-auto mt-3 max-w-6xl px-4">
          <div
            className={[
              'rounded-lg border px-3 py-2 text-sm flex items-center gap-2',
              txError ? 'bg-rose-900/40 border-rose-500/40 text-rose-100' : 'bg-emerald-900/30 border-emerald-500/30 text-emerald-100'
            ].join(' ')}
          >
            {verifying || (loading && !txError) ? <Spinner /> : <span>✅</span>}
            <div className="flex-1">
              <div className="font-medium">{txStatus || (txError ? 'Error' : '')}</div>
              {txError && <div className="text-rose-100/80">{txError}</div>}
            </div>
            {txHash && (
              <a
                className="underline decoration-dotted"
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Tx
              </a>
            )}
          </div>
        </div>
      )}

      {/* Hero (matches other pages) */}
      <section className="mx-auto max-w-6xl px-4 pt-8 md:pt-12">
        <div className="rounded-2xl bg-gradient-to-br from-pink-700 via-indigo-700 to-cyan-700 p-6 md:p-8 shadow-xl ring-1 ring-white/10">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">🎨 Make Your Own</h1>
              <p className="text-indigo-100 mt-2 max-w-2xl">
                Drop <code className="px-1 py-0.5 bg-slate-900/40 rounded">[BLANK]</code> where players will fill words.
                Pick a vibe, then mint your Template NFT on <span className="font-semibold">Base</span>.
              </p>
            </div>
            <div className="rounded-xl bg-slate-900/40 ring-1 ring-white/10 p-4">
              <h3 className="font-semibold mb-2">Quick Steps</h3>
              <ol className="space-y-2 text-sm text-slate-100/90 list-decimal list-inside">
                <li>Write a story with [BLANK]</li>
                <li>Set Title, Theme & Background</li>
                <li>Review limits</li>
                <li>Mint Template NFT</li>
              </ol>

              <div className="mt-3 space-y-2">
                {!isConnected ? (
                  <Button onClick={connect} className="bg-amber-500 hover:bg-amber-400 text-black w-full">
                    Connect Wallet
                  </Button>
                ) : !isOnBase ? (
                  <div className="text-amber-300 bg-amber-900/30 border border-amber-700 rounded-md px-3 py-2 text-sm">
                    ⚠️ Wrong network. Switch to <b>Base (8453)</b>.
                  </div>
                ) : null}

                {/* Quick toggle for debug */}
                <Button variant="outline" onClick={() => setShowDebug((v) => !v)} className="w-full border-slate-600 text-slate-200">
                  {showDebug ? 'Hide Debug' : 'Show Debug'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8 text-white space-y-6">
        {/* Limits strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2">
            <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden text-[12px] sm:text-sm">
              <span className="shrink-0">Mint fee:</span>
              <b className="shrink-0">{DISPLAY_FEE_ETH} ETH</b>
              <span className="opacity-70 shrink-0">+ gas</span>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2">
            <div className="flex items-center justify-between">
              <span>Parts</span>
              <span className="font-semibold">{partsForContract.length} / {maxParts}</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-slate-700">
              <div
                className="h-1.5 rounded bg-indigo-400"
                style={{ width: `${Math.min(100, (partsForContract.length / maxParts) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2">
            <div className="flex items-center justify-between">
              <span>Total bytes</span>
              <span className="font-semibold">{totalContractBytes} / {maxTotalBytes}</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-slate-700">
              <div
                className="h-1.5 rounded bg-emerald-400"
                style={{ width: `${Math.min(100, (totalContractBytes / maxTotalBytes) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {paused && (
          <div className="text-sm rounded-lg bg-rose-900/40 border border-rose-700 px-3 py-2 text-rose-100">
            ⏸️ Minting is currently paused.
          </div>
        )}

        {/* Debug panel */}
        {showDebug && (
          <div className="rounded-lg bg-slate-900/70 border border-amber-500/40 p-4 text-xs">
            <div className="font-semibold mb-2 text-amber-300">Debug</div>
            <div className="grid sm:grid-cols-2 gap-y-1">
              <div>isConnected: {String(isConnected)}</div>
              <div>isOnBase: {String(isOnBase)}</div>
              <div>NFT_ADDRESS: {String(NFT_ADDRESS || '(missing)')}</div>
              <div>BASE_RPC: {String(BASE_RPC || '(missing)')}</div>
              <div>paused: {String(paused)}</div>
              <div>blankCount: {blankCount}</div>
              <div>partsForContract.length: {partsForContract.length}</div>
              <div>maxParts: {maxParts}</div>
              <div>maxPartBytes: {maxPartBytes}</div>
              <div>totalContractBytes: {totalContractBytes}</div>
              <div>maxTotalBytes: {maxTotalBytes}</div>
              <div>mintTemplateNFT typeof: {typeof mintTemplateNFT}</div>
              <div>address: {String(address || '(none)')}</div>
            </div>
            {reasonsCantMint.length > 0 && (
              <div className="mt-3 text-rose-200">
                <div className="font-semibold">Why can’t I mint?</div>
                <ul className="list-disc list-inside">
                  {reasonsCantMint.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

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
                  Parts: <b>{partsForContract.length}</b> / {maxParts} • Contract text bytes: <b>{contractTextBytes}</b> • Total bytes: <b>{totalContractBytes}</b> / {maxTotalBytes}
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
                    <StyledCard parts={partsForPreview} blanks={blankCount} words={wordsForPreview} />
                  </div>
                </div>
              </div>

              {/* Fee + reasons */}
              <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                <div className="flex items-center gap-3 whitespace-nowrap overflow-hidden text-[12px] sm:text-sm">
                  <div className="shrink-0">
                    Mint fee: <b>{DISPLAY_FEE_ETH} ETH</b>
                    <span className="opacity-70"> + gas (finalized on-chain)</span>
                  </div>
                  <div className="opacity-80 shrink-0">•</div>
                  <div className="shrink-0">Blanks to fill by players: <b>{blankCount}</b></div>
                </div>
                {!canMint && reasonsCantMint.length > 0 && (
                  <div className="mt-2 text-xs text-amber-200">
                    <span className="font-semibold">Why can’t I mint?</span>
                    <ul className="list-disc list-inside">
                      {reasonsCantMint.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  onClick={handleMint}
                  disabled={!canMint}
                  className={`w-full ${paused ? 'bg-slate-700' : 'bg-purple-600 hover:bg-purple-500'}`}
                  title={!canMint && reasonsCantMint.length ? reasonsCantMint[0] : ''}
                >
                  {loading ? 'Minting…' : paused ? 'Paused' : 'Mint Template NFT'}
                </Button>
                <Button
                  type="button"
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
                Seeing <i>“execution reverted / no data”</i>? Ensure at least one <code>[BLANK]</code> remains and parts/bytes are within limits, and verify you’re on <b>Base</b>.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {showConfetti && width > 0 && height > 0 && <Confetti width={width} height={height} />}

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-800 pt-6 pb-10 text-center text-slate-400 text-sm">
        <p>✨ Built with MadFill — Fill, laugh, and share ✨</p>
        <p className="mt-1">
          <a href="/" className="hover:text-white transition">Home</a> ·{' '}
          <a href="/active" className="hover:text-white transition">Active Rounds</a> ·{' '}
          <a href="/challenge" className="hover:text-white transition">Challenge</a> ·{' '}
          <a href="/vote" className="hover:text-white transition">Vote</a>
        </p>
      </footer>
    </Layout>
  )
}
