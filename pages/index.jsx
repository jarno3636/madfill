'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { ethers } from 'ethers'
import { useWindowSize } from 'react-use'

import Layout from '@/components/Layout'
import SEO from '@/components/SEO'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import StyledCard from '@/components/StyledCard'
import ShareBar from '@/components/ShareBar'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'
import { useToast } from '@/components/Toast'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { categories as presetCategories } from '@/data/templates'

// ✅ unified provider (the only wallet/tx source)
import { useTx } from '@/components/TxProvider'

// For decoding events (already in your project per TxProvider)
import fillinAbi from '@/abi/FillInStoryV3_ABI.json'

// Client-only confetti
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

/* ========== Read-only Pools Contract bits ========== */
const FILLIN_ADDR_FALLBACK =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

const POOLS_ABI = [
  { inputs: [], name: 'FEE_BPS', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'BPS_DENOMINATOR', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
]

/* ---------- optional deploy blocks to speed up log queries ---------- */
const FILLIN_DEPLOY_BLOCK = Number(process.env.NEXT_PUBLIC_FILLIN_DEPLOY_BLOCK || 0) || null
const NFT_DEPLOY_BLOCK    = Number(process.env.NEXT_PUBLIC_NFT_DEPLOY_BLOCK || 0) || null

/* ========== Helpers ========== */
const sanitizeOneWord = (raw) =>
  String(raw || '')
    .trim()
    .split(' ')[0]
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    .slice(0, 16)

const BG_CHOICES = [
  { key: 'indigoNebula', label: 'Indigo Nebula', cls: 'from-indigo-900 via-purple-800 to-slate-900' },
  { key: 'candy',        label: 'Candy',         cls: 'from-pink-600 via-fuchsia-600 to-purple-700' },
  { key: 'tealSunset',   label: 'Teal Sunset',   cls: 'from-teal-600 via-cyan-700 to-indigo-800' },
  { key: 'magma',        label: 'Magma',         cls: 'from-orange-600 via-rose-600 to-fuchsia-700' },
  { key: 'forest',       label: 'Forest',        cls: 'from-emerald-700 via-teal-700 to-slate-900' },
]

/* ---------- tiny UI helper ---------- */
const StatTile = ({ label, value, sub, className = '' }) => (
  <div className={`rounded-xl border border-slate-700 bg-slate-900/60 p-4 ${className}`}>
    <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-1 text-3xl font-extrabold">{value}</div>
    {sub ? <div className="text-xs text-slate-400 mt-1">{sub}</div> : null}
  </div>
)

function IndexPage() {
  useMiniAppReady()
  const { addToast } = useToast()
  const { width, height } = useWindowSize()

  // ✅ single unified source
  const {
    createPool1, isConnected, connect, isOnBase, switchToBase,
    BASE_RPC, FILLIN_ADDRESS, NFT_ADDRESS
  } = useTx()

  // chain / fees
  const [feeBps, setFeeBps] = useState(null)
  const [bpsDen, setBpsDen] = useState(10000)

  // ui
  const [showConfetti, setShowConfetti] = useState(false)
  const [loading, setLoading] = useState(false)

  // template pickers
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const currentCategory = presetCategories[catIdx] || { name: 'Custom', templates: [] }
  const currentTemplates = currentCategory.templates || []
  const currentTemplate = currentTemplates[tplIdx] || null

  // round meta
  const [title, setTitle] = useState('')
  const [theme, setTheme] = useState('')
  const [username, setUsername] = useState('')
  const [bgKey, setBgKey] = useState(BG_CHOICES[0].key)

  // parts come from template ONLY
  const parts = useMemo(() => currentTemplate?.parts ?? [], [currentTemplate])
  const blanksCount = Math.max(0, (parts?.length || 0) - 1)
  const [blankIndex, setBlankIndex] = useState(0)

  // creator entry
  const [creatorWord, setCreatorWord] = useState('')

  // entry fee (ETH → WEI)
  const [feeEth, setFeeEth] = useState('0.0005')
  const feeWei = useMemo(() => {
    try { return ethers.parseEther((feeEth || '0').trim()) } catch { return 0n }
  }, [feeEth])

  // duration (days → secs)
  const templateDayOptions = useMemo(() => {
    if (Array.isArray(currentTemplate?.durationDaysOptions) && currentTemplate.durationDaysOptions.length) {
      return currentTemplate.durationDaysOptions
    }
    return [1,2,3,4,5,6,7]
  }, [currentTemplate])

  const [durationDays, setDurationDays] = useState(templateDayOptions[0] || 1)
  useEffect(() => { setDurationDays(templateDayOptions[0] || 1) }, [templateDayOptions])
  const durationSecs = useMemo(() => BigInt(Math.max(1, Number(durationDays)) * 24 * 60 * 60), [durationDays])

  // usd display
  the:
  const [usd, setUsd] = useState(null)

  // preview words map
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

  /* ---------- read fee bps (read-only RPC) ---------- */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = new ethers.JsonRpcProvider(BASE_RPC)
        const addr = FILLIN_ADDRESS || FILLIN_ADDR_FALLBACK
        const ct = new ethers.Contract(addr, POOLS_ABI, p)
        const [fee, den] = await Promise.all([
          ct.FEE_BPS().catch(() => null),
          ct.BPS_DENOMINATOR().catch(() => 10000n),
        ])
        if (!cancelled) {
          setFeeBps(fee != null ? Number(fee) : null)
          setBpsDen(Number(den || 10000n))
        }
      } catch {
        if (!cancelled) { setFeeBps(null); setBpsDen(10000) }
      }
    })()
    return () => { cancelled = true }
  }, [BASE_RPC, FILLIN_ADDRESS])

  // usd (display)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const j = await r.json()
        if (!cancelled) setUsd(Number(j?.ethereum?.usd || 0))
      } catch { if (!cancelled) setUsd(null) }
    })()
    return () => { cancelled = true }
  }, [])

  // keep chosen blank index in bounds when template changes
  useEffect(() => {
    setBlankIndex((i) => Math.max(0, Math.min(Math.max(0, blanksCount - 1), i)))
  }, [blanksCount])

  const doSwitchToBase = useCallback(async () => {
    const ok = await switchToBase()
    if (!ok) {
      addToast({ type: 'error', title: 'Switch Failed', message: 'Could not switch to Base.' })
    }
  }, [switchToBase, addToast])

  /* ---------- apply template ---------- */
  const applyTemplate = useCallback(() => {
    const t = currentTemplate
    if (!t) return
    setTitle(t.name || '')
    setTheme(currentCategory.name || '')
    if (Array.isArray(t.durationDaysOptions) && t.durationDaysOptions.length) {
      setDurationDays(Number(t.durationDaysOptions[0]))
    } else {
      setDurationDays(1)
    }
  }, [currentTemplate, currentCategory])

  /* ---------- validation & tx ---------- */
  const validate = () => {
    const addr = FILLIN_ADDRESS || FILLIN_ADDR_FALLBACK
    if (!addr) { addToast({ type: 'error', title: 'Contract Missing', message: 'Set NEXT_PUBLIC_FILLIN_ADDRESS.' }); return false }
    if (!isConnected) { addToast({ type: 'error', title: 'Wallet Required', message: 'Connect your wallet to create a round.' }); return false }
    if (!currentTemplate) { addToast({ type: 'error', title: 'Choose a Template', message: 'Pick a category and template.' }); return false }
    if (!title.trim() || !theme.trim()) { addToast({ type: 'error', title: 'Missing Fields', message: 'Title and Theme are required.' }); return false }
    if (blanksCount < 1) { addToast({ type: 'error', title: 'No Blanks', message: 'Selected template must have at least one blank.' }); return false }
    const word = sanitizeOneWord(creatorWord)
    if (!word) { addToast({ type: 'error', title: 'Your Word', message: 'Enter your one-word entry (letters/numbers/_/-, max 16).' }); return false }
    if (blankIndex < 0 || blankIndex >= blanksCount) { addToast({ type: 'error', title: 'Blank Index', message: 'Select which blank you are filling.' }); return false }
    if (feeWei <= 0n) { addToast({ type: 'error', title: 'Entry Fee', message: 'Set a positive entry fee (e.g., 0.0005).' }); return false }
    if (durationSecs < 60n) { addToast({ type: 'error', title: 'Duration', message: 'Duration must be at least 1 minute.' }); return false }
    return true
  }

  const handleCreatePool1 = async () => {
    if (!validate()) return
    try {
      setLoading(true)

      await createPool1({
        title: String(title).slice(0, 128),
        theme: String(theme).slice(0, 128),
        parts,
        word: sanitizeOneWord(creatorWord),
        username: String(username || '').slice(0, 64),
        feeBaseWei: feeWei,
        durationSecs,
        blankIndex: Number(blankIndex) & 0xff,
      })

      addToast({ type: 'success', title: 'Round Created!', message: 'Your Pool 1 round is live.' })
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 1600)
      setCreatorWord('')
    } catch (e) {
      console.error(e)
      const msg = e?.info?.error?.message || e?.shortMessage || e?.reason || e?.message || 'Transaction failed.'
      addToast({ type: 'error', title: 'Create Failed', message: msg })
      setShowConfetti(false)
    } finally { setLoading(false) }
  }

  /* ---------- SEO / frame ---------- */
  const pageUrl = absoluteUrl('/')
  const ogImage = buildOgUrl({ screen: 'home', title: 'MadFill — Create a Round' })
  const feeUsd = (usd && feeEth) ? (parseFloat(feeEth || '0') * usd) : null

  /* ================== LIVE STATS (bottom card) ================== */
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(null)
  const [stats, setStats] = useState({
    totalPools: 0,
    claimedPools: 0,
    activePools: 0,
    totalChallenges: 0,
    nftsMinted: 0,
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setStatsLoading(true)
      setStatsError(null)
      try {
        const provider = new ethers.JsonRpcProvider(BASE_RPC)

        const poolsAddr = (FILLIN_ADDRESS || FILLIN_ADDR_FALLBACK)
        const nftAddr   = NFT_ADDRESS

        // fromBlock windows
        const latest = await provider.getBlockNumber()
        const defaultWindow = Math.max(0, latest - 500_000) // fallback window if deploy block unknown
        const poolsFrom = FILLIN_DEPLOY_BLOCK ?? defaultWindow
        const nftFrom   = NFT_DEPLOY_BLOCK ?? defaultWindow

        // ----- Pools logs: fetch all events for FillIn (bounded by fromBlock)
        let poolLogs = []
        try {
          poolLogs = await provider.getLogs({
            address: poolsAddr,
            fromBlock: poolsFrom,
            toBlock: 'latest',
          })
        } catch {}

        const iface = new ethers.Interface(fillinAbi)
        let totalPools = 0
        let claimedPools = 0
        let totalChallenges = 0

        for (const lg of poolLogs) {
          try {
            const parsed = iface.parseLog(lg)
            const name = parsed?.name || ''
            const lname = name.toLowerCase()
            if (lname.includes('poolcreated')) totalPools += 1
            if (lname.includes('poolclaimed') || lname.includes('claimed')) claimedPools += 1
            if (lname.includes('join') || lname.includes('challenge')) totalChallenges += 1
          } catch {
            // ignore unknown events
          }
        }

        const activePools = Math.max(0, totalPools - claimedPools)

        // ----- NFT mints: ERC-721 Transfer where from == 0x0
        let nftsMinted = 0
        if (nftAddr) {
          const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)')
          const ZERO_TOPIC = ethers.zeroPadValue(ethers.ZeroAddress, 32)
          let nftLogs = []
          try {
            nftLogs = await provider.getLogs({
              address: nftAddr,
              fromBlock: nftFrom,
              toBlock: 'latest',
              topics: [TRANSFER_TOPIC, ZERO_TOPIC], // mint events only
            })
          } catch {}
          nftsMinted = nftLogs.length
        }

        if (!cancelled) {
          setStats({ totalPools, claimedPools, activePools, totalChallenges, nftsMinted })
          setStatsLoading(false)
        }
      } catch (err) {
        console.error('stats error', err)
        if (!cancelled) {
          setStatsError('Could not load on-chain stats')
          setStatsLoading(false)
        }
      }
    }

    load()
    const id = setInterval(load, 60_000) // refresh every minute
    return () => { cancelled = true; clearInterval(id) }
  }, [BASE_RPC, FILLIN_ADDRESS, NFT_ADDRESS])

  const pctClaimed = useMemo(() => {
    const tot = stats.totalPools || 0
    return tot > 0 ? Math.min(100, Math.round((stats.claimedPools / tot) * 100)) : 0
  }, [stats.totalPools, stats.claimedPools])

  const pctActive = useMemo(() => {
    const tot = stats.totalPools || 0
    return tot > 0 ? Math.min(100, Math.round((stats.activePools / tot) * 100)) : 0
  }, [stats.totalPools, stats.activePools])

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
        description="Create a Pool 1 round on Base: pick a template, set the entry fee, choose the blank, and launch."
        url={pageUrl}
        image={ogImage}
        type="website"
        twitterCard="summary_large_image"
      />

      {showConfetti && width > 0 && height > 0 && <Confetti width={width} height={height} />}

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-8 md:pt-12">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900/70 to-purple-900/70 border border-indigo-700 p-6 md:p-8 shadow-xl">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">🧠 MadFill — Create a Round</h1>
              <p className="text-indigo-100 mt-4">
                MadFill is a social word game on Base. Pick a template with blanks, choose <em>which</em> blank
                you’ll fill, set the entry fee, and launch a round. Players submit their best word. Community votes. Winners split the pot.
              </p>
            </div>
            <div className="rounded-xl bg-slate-900/50 border border-slate-700 p-4">
              <h3 className="font-semibold mb-2">Quick Steps</h3>
              <ol className="space-y-2 text-sm text-slate-200 list-decimal list-inside">
                <li>Choose Category & Template</li>
                <li>Pick the Blank you’ll fill</li>
                <li>Set Entry Fee & Duration</li>
                <li>Launch Pool&nbsp;1</li>
              </ol>
              <div className="mt-3">
                {!isConnected ? (
                  <Button onClick={connect} className="bg-amber-500 hover:bg-amber-400 text-black w-full">
                    Connect Wallet
                  </Button>
                ) : !isOnBase ? (
                  <Button onClick={doSwitchToBase} className="bg-cyan-600 hover:bg-cyan-500 w-full">
                    Switch to Base
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Builder */}
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Setup */}
          <Card className="bg-slate-900/70 border border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <h2 className="text-xl font-bold">Round Setup</h2>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              {/* Template selectors */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-sm text-slate-300">
                  Category
                  <select
                    value={catIdx}
                    onChange={(e) => { setCatIdx(+e.target.value); setTplIdx(0) }}
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {presetCategories.map((c, i) => (
                      <option key={i} value={i}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-300 md:col-span-2">
                  Template
                  <select
                    value={tplIdx}
                    onChange={(e) => setTplIdx(+e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {currentTemplates.map((t, i) => (
                      <option key={i} value={i}>{t.name} ({t.blanks} blanks)</option>
                    ))}
                  </select>
                </label>
              </div>
              <Button onClick={applyTemplate} className="bg-fuchsia-600 hover:bg-fuchsia-500" type="button">
                Use This Template
              </Button>

              {/* Title / Theme */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-sm text-slate-300 md:col-span-2">
                  Title
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Template title"
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    maxLength={128}
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Theme
                  <input
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="Category / Theme"
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    maxLength={128}
                  />
                </label>
              </div>

              {/* Username / Word */}
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
                    className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                    maxLength={16}
                  />
                  <span className="text-xs text-slate-400">{(creatorWord || '').length}/16</span>
                </label>
              </div>

              {/* Which blank to fill */}
              <div className="space-y-2">
                <div className="text-sm text-slate-300">Choose which blank you’ll fill</div>
                {blanksCount === 0 ? (
                  <div className="text-xs text-amber-300">Pick a template that includes blanks.</div>
                ) : (
                  <>
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
                    <label className="block text-xs text-slate-300">
                      Or pick with context
                      <select
                        className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                        value={blankIndex}
                        onChange={(e) => setBlankIndex(+e.target.value)}
                      >
                        {Array.from({ length: blanksCount }).map((_, i) => {
                          const left = (parts[i] || '').split(/\s+/).slice(-3).join(' ')
                          const right = (parts[i + 1] || '').split(/\s+/).slice(0, 3).join(' ')
                          return <option key={i} value={i}>#{i + 1} — {left} [____] {right}</option>
                        })}
                      </select>
                    </label>
                  </>
                )}
              </div>

              {/* Fee selector */}
              <div className="space-y-2">
                <div className="text-sm text-slate-300">Entry Fee (per player)</div>
                <div className="flex flex-wrap items-center gap-2">
                  {['0.0005', '0.001', '0.005'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setFeeEth(v)}
                      className={`px-3 py-1.5 rounded text-sm border whitespace-nowrap ${
                        feeEth === v ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {v} ETH
                    </button>
                  ))}
                  <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700 rounded-lg px-2 py-1.5 whitespace-nowrap">
                    <input
                      inputMode="decimal"
                      value={feeEth}
                      onChange={(e) => setFeeEth(e.target.value)}
                      className="w-28 font-mono bg-transparent outline-none"
                      placeholder="0.0000"
                    />
                    <span className="text-slate-300 text-sm">ETH</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400 text-sm">
                      {usd && feeEth ? `~$${(parseFloat(feeEth || '0') * usd).toFixed(2)}` : '—'}
                    </span>
                    {feeBps != null && (
                      <>
                        <span className="text-slate-500">|</span>
                        <span className="text-xs text-slate-400">burn {(feeBps / bpsDen * 100).toFixed(2)}%</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">+ gas</span>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <div className="text-sm text-slate-300">Duration</div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg bg-slate-800/70 border border-slate-700 px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                  >
                    {templateDayOptions.map((d) => (
                      <option key={d} value={d}>
                        {d === 7 ? '1 week' : `${d} day${d > 1 ? 's' : ''}`}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400">
                    Selected: <b>{durationDays === 7 ? '1 week' : `${durationDays} day${durationDays > 1 ? 's' : ''}`}</b>
                  </span>
                </div>
              </div>

              {/* Backgrounds */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">Card Background</div>
                  <Button
                    onClick={() => {
                      const idx = BG_CHOICES.findIndex((b) => b.key === bgKey)
                      const next = (idx + 1) % BG_CHOICES.length
                      setBgKey(BG_CHOICES[next].key)
                    }}
                    variant="outline"
                    className="border-slate-600 text-slate-200"
                  >
                    🔀 Randomize
                  </Button>
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

          {/* Right: Preview & Launch */}
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

              {/* Compact summary */}
              <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    Entry fee: <b className="font-mono">{feeEth || '—'} ETH</b>
                    {feeUsd != null && <span className="opacity-80"> (~${feeUsd.toFixed(2)})</span>}
                    <span className="opacity-70"> + gas</span>
                  </div>
                  <div className="opacity-80">•</div>
                  <div>Blanks: <b>{blanksCount}</b></div>
                  <div className="opacity-80">•</div>
                  <div>You’re filling: <b>{blanksCount ? `Blank #${blankIndex + 1}` : '—'}</b></div>
                  {feeBps != null && (
                    <>
                      <div className="opacity-80">•</div>
                      <div>Protocol fee (burn): <b>{(feeBps / bpsDen * 100).toFixed(2)}%</b></div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleCreatePool1}
                  disabled={
                    loading ||
                    !isConnected ||
                    !currentTemplate ||
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
                  onClick={() => { setUsername(''); setCreatorWord(''); setBlankIndex(0) }}
                  className="border-slate-600 text-slate-200 w-full"
                >
                  Clear (keep template)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fee breakdown + ShareBar */}
        <Card className="bg-slate-900/70 border border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <h3 className="text-lg font-bold">Fee Breakdown</h3>
          </CardHeader>
          <CardContent className="p-5 text-sm text-slate-200 space-y-2">
            <p>
              <b>Entry Fee:</b> You pick it (e.g., <span className="font-mono">{feeEth} ETH</span>), paid by each player
              who enters. It goes into the prize pool.
              {feeUsd != null && <> Estimated: ~${feeUsd.toFixed(2)}.</>}
            </p>
            <p>
              <b>Protocol Fee (burn):</b> {feeBps != null ? `${(feeBps / bpsDen * 100).toFixed(2)}%` : '—'} of the entry fee is burned at the protocol level.
            </p>
            <p>
              <b>Gas:</b> Network fee paid to validators. Varies with network congestion.
            </p>

            <div className="mt-4">
              <ShareBar
                url={pageUrl}
                title="🧠 I’m creating MadFill rounds on Base — come play!"
                theme="MadFill"
                templateName={title || 'Create a Round'}
                feeEth={feeEth}
                durationMins={Number(durationDays) * 24 * 60}
                hashtags={['MadFill','Base','Farcaster']}
                embed="/og/cover.PNG"
              />
            </div>
          </CardContent>
        </Card>

        {/* ===================== Live Network Stats ===================== */}
        <Card className="bg-slate-900/70 border border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <h3 className="text-lg font-bold">Network Activity</h3>
            {statsError && <div className="mt-2 text-xs text-rose-300">{statsError}</div>}
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatTile label="Active Pools"   value={statsLoading ? '—' : stats.activePools} sub={!statsLoading && `${pctActive}% of total`} />
              <StatTile label="Claimed Pools"  value={statsLoading ? '—' : stats.claimedPools} sub={!statsLoading && `${pctClaimed}% of total`} />
              <StatTile label="Total Pools"    value={statsLoading ? '—' : stats.totalPools} />
              <StatTile label="Challenges"     value={statsLoading ? '—' : stats.totalChallenges} />
              <StatTile label="NFTs Minted"    value={statsLoading ? '—' : stats.nftsMinted} />
            </div>

            {/* Simple progress bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Active vs Total</span>
                  <span>{statsLoading ? '—' : `${stats.activePools}/${stats.totalPools}`}</span>
                </div>
                <div className="mt-2 h-2 rounded bg-slate-700">
                  <div className="h-2 rounded bg-emerald-400 transition-all" style={{ width: `${pctActive}%` }} />
                </div>
              </div>
              <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Claimed vs Total</span>
                  <span>{statsLoading ? '—' : `${stats.claimedPools}/${stats.totalPools}`}</span>
                </div>
                <div className="mt-2 h-2 rounded bg-slate-700">
                  <div className="h-2 rounded bg-indigo-400 transition-all" style={{ width: `${pctClaimed}%` }} />
                </div>
              </div>
            </div>

            {/* Tiny legend */}
            <div className="text-xs text-slate-400">
              Updated every minute from Base via <span className="font-mono">BASE_RPC</span>. Set <span className="font-mono">NEXT_PUBLIC_FILLIN_DEPLOY_BLOCK</span> and <span className="font-mono">NEXT_PUBLIC_NFT_DEPLOY_BLOCK</span> for faster queries.
            </div>
          </CardContent>
        </Card>
      </main>
    </Layout>
  )
}

export default dynamic(() => Promise.resolve(IndexPage), { ssr: false })
