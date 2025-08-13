// components/InfoMintCard.jsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { ethers } from 'ethers'
import { Button } from '@/components/ui/button'
import NFT_ABI from '@/abi/MadFillTemplateNFT_ABI.json'
import { absoluteUrl } from '@/lib/seo'

const ENV_BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASESCAN = 'https://basescan.org'

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—'
}

/** Try the first contract method that exists; returns null if none succeed. */
async function callFirst(contract, candidates = [], args = []) {
  for (const name of candidates) {
    try {
      const fn = contract?.[name]
      if (typeof fn !== 'function') continue
      // Some view functions are defined without (), some with (args)
      const res = await fn(...args)
      return res
    } catch {
      // keep trying next name
    }
  }
  return null
}

/** Mini-app aware openURL (safe on SSR) */
async function openUrl(url) {
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    // Prefer class API (stable across SDK revs)
    const MiniAppSDK = mod?.MiniAppSDK || mod?.default
    if (MiniAppSDK) {
      const sdk = new MiniAppSDK()
      if (sdk?.actions?.openURL) {
        await sdk.actions.openURL(url)
        return
      }
    }
  } catch {
    // ignore; fall back below
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export default function InfoMintCard({ contractAddress, rpcUrl = ENV_BASE_RPC }) {
  const [ethWei, setEthWei] = useState(null)       // bigint | null
  const [usdE6, setUsdE6] = useState(null)         // number | null
  const [royaltyBps, setRoyaltyBps] = useState(null)
  const [payout, setPayout] = useState(null)

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!contractAddress) {
      setErr('Contract address not set')
      setLoading(false)
      return
    }

    const load = async (attempt = 0) => {
      setLoading(true)
      setErr('')

      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl)
        const ct = new ethers.Contract(contractAddress, NFT_ABI, provider)

        // Probe common method names defensively
        const [wei, priceE6, bps, wallet] = await Promise.all([
          callFirst(ct, ['getMintPriceWei', 'mintPriceWei', 'MINT_PRICE_WEI']),     // bigint|null
          (async () => {
            const peg = await callFirst(ct, ['mintPriceUsdE6', 'MINT_PRICE_USD_E6'])
            return peg != null ? Number(peg) : null
          })(),
          (async () => {
            // Prefer DEFAULT_ROYALTY_BPS; fall back to a constant or 0
            const v = await callFirst(ct, ['DEFAULT_ROYALTY_BPS', 'royaltyBps'])
            return v != null ? Number(v) : null
          })(),
          callFirst(ct, ['payoutWallet', 'withdrawAddress', 'treasury', 'beneficiary']),
        ])

        if (!mounted.current) return
        if (wei != null) setEthWei(wei)
        if (priceE6 != null) setUsdE6(priceE6)
        if (bps != null) setRoyaltyBps(bps)
        if (wallet) setPayout(wallet)
      } catch (e) {
        if (attempt === 0) return load(1) // tiny retry for transient RPC hiccup
        if (!mounted.current) return
        // eslint-disable-next-line no-console
        console.warn('InfoMintCard error:', e)
        setErr(e?.shortMessage || e?.reason || e?.message || 'Could not fetch live mint info.')
      } finally {
        if (mounted.current) setLoading(false)
      }
    }

    load()
  }, [contractAddress, rpcUrl])

  const priceEthStr = ethWei != null ? Number(ethers.formatEther(ethWei)).toFixed(5) : null
  const priceUsdStr = usdE6 != null ? (usdE6 / 1_000_000).toFixed(2) : null

  const siteUrl = absoluteUrl('/myo')
  const prefill = encodeURIComponent(
    `I’m minting a custom MadFill template on Base.\n\nBuild yours in a minute: ${siteUrl}`
  )

  return (
    <div className="rounded-xl border border-indigo-700/60 bg-gradient-to-br from-indigo-900/60 to-purple-900/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">ℹ️ What’s this page?</h3>
        <span className="text-xs text-indigo-200">
          Contract:{' '}
          {contractAddress ? (
            <a
              className="underline decoration-dotted"
              href={`${BASESCAN}/address/${contractAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddr(contractAddress)} ↗
            </a>
          ) : (
            <code className="font-mono">—</code>
          )}
        </span>
      </div>

      <p className="mt-2 text-sm text-indigo-100">
        Create your <strong>MadFill template</strong> (title, theme, and parts with blanks like{' '}
        <span className="font-mono">____</span>), then mint it as an NFT on <strong>Base</strong>. You keep
        authorship on-chain; anyone can remix your vibe in-game.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
          <p className="text-xs text-slate-300">Mint Price</p>
          <p className="text-base font-mono">
            {loading ? '…' : priceEthStr ? `${priceEthStr} ETH` : '—'}
          </p>
          <p className="text-xs text-slate-400">
            {loading ? ' ' : priceUsdStr ? `≈ $${priceUsdStr} USD (on-chain peg)` : 'USD peg unavailable'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
          <p className="text-xs text-slate-300">Royalty (ERC-2981)</p>
          <p className="text-base font-mono">
            {loading ? '…' : royaltyBps != null ? `${(royaltyBps / 100).toFixed(2)}%` : '—'}
          </p>
          <p className="text-xs text-slate-400">For secondary sales</p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
          <p className="text-xs text-slate-300">Payout Wallet</p>
          <p className="text-sm font-mono">{loading ? '…' : shortAddr(payout)}</p>
          <p className="text-xs text-slate-400">Primary mint funds go here</p>
        </div>
      </div>

      {err && <p className="mt-2 text-xs text-red-200">⚠️ {err}</p>}

      <div className="mt-5 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <h4 className="mb-1 font-semibold">How to mint</h4>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-200">
          <li>Write a catchy title + short description.</li>
          <li>
            Pick a theme and add sentence parts. Use <span className="font-mono">____</span> for blanks.
          </li>
          <li>Preview to sanity-check.</li>
          <li>Hit <b>Mint Template</b> and approve (on Base).</li>
        </ol>
        <div className="mt-2 text-xs text-slate-400">
          Gas is additional. Mint price may peg to USD at tx time; shown USD is informational.
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              openUrl(
                contractAddress
                  ? `${BASESCAN}/address/${contractAddress}`
                  : 'https://basescan.org'
              )
            }
            className="bg-slate-700 text-xs hover:bg-slate-600"
          >
            🔎 View Contract on BaseScan
          </Button>
          <Button
            onClick={() => openUrl(`https://warpcast.com/~/compose?text=${prefill}`)}
            className="bg-purple-600 text-xs hover:bg-purple-500"
          >
            🌀 Tell friends on Farcaster
          </Button>
        </div>
      </div>
    </div>
  )
}
