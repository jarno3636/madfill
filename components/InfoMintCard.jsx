// components/InfoMintCard.jsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { ethers } from 'ethers'
import { Button } from '@/components/ui/button'
import NFT_ABI from '@/abi/MadFillTemplateNFT_ABI.json'

const BASE_RPC = 'https://mainnet.base.org'
const BASESCAN = 'https://basescan.org'

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—'
}

export default function InfoMintCard({ contractAddress, rpcUrl = BASE_RPC }) {
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

        // Some contracts might not have mintPriceUsdE6; probe carefully.
        const maybeUsd = async () => {
          try {
            const v = await ct.mintPriceUsdE6?.()
            return v != null ? Number(v) : null
          } catch {
            return null
          }
        }

        const [wei, priceE6, bps, wallet] = await Promise.all([
          ct.getMintPriceWei(),              // bigint
          maybeUsd(),                        // number|null
          ct.DEFAULT_ROYALTY_BPS(),          // bigint
          ct.payoutWallet(),                 // address
        ])

        if (!mounted.current) return
        setEthWei(wei)
        setUsdE6(priceE6)
        setRoyaltyBps(Number(bps))
        setPayout(wallet)
      } catch (e) {
        if (attempt === 0) {
          // tiny retry for transient RPC flakes
          return load(1)
        }
        if (!mounted.current) return
        console.warn('InfoMintCard error:', e)
        setErr('Could not fetch live mint info.')
      } finally {
        if (mounted.current) setLoading(false)
      }
    }

    load()
  }, [contractAddress, rpcUrl])

  const priceEthStr = ethWei != null ? Number(ethers.formatEther(ethWei)).toFixed(5) : null
  const priceUsdStr = usdE6 != null ? (usdE6 / 1_000_000).toFixed(2) : null

  return (
    <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/60 border border-indigo-700/60 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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

      <p className="text-sm text-indigo-100 mt-2">
        Create your <strong>MadFill template</strong> (title, theme, and parts with blanks like <span className="font-mono">____</span>),
        then mint it as an NFT on <strong>Base</strong>. You keep authorship on-chain; anyone can remix your vibe in-game.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mt-4">
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-300">Mint Price</p>
          <p className="text-base font-mono">
            {loading ? '…' : priceEthStr ? `${priceEthStr} ETH` : '—'}
          </p>
          <p className="text-xs text-slate-400">
            {loading
              ? ' '
              : priceUsdStr
              ? `≈ $${priceUsdStr} USD (on-chain peg)`
              : 'USD peg unavailable'}
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-300">Royalty (ERC-2981)</p>
          <p className="text-base font-mono">
            {loading ? '…' : royaltyBps != null ? `${(royaltyBps / 100).toFixed(2)}%` : '—'}
          </p>
          <p className="text-xs text-slate-400">For secondary sales</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-300">Payout Wallet</p>
          <p className="text-sm font-mono">{loading ? '…' : shortAddr(payout)}</p>
          <p className="text-xs text-slate-400">Primary mint funds go here</p>
        </div>
      </div>

      {err && <p className="mt-2 text-xs text-red-200">⚠️ {err}</p>}

      <div className="mt-5 bg-slate-800/60 border border-slate-700 rounded-lg p-4">
        <h4 className="font-semibold mb-1">How to mint</h4>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-200">
          <li>Write a catchy title + short description.</li>
          <li>Pick a theme and add sentence parts. Use <span className="font-mono">____</span> for blanks.</li>
          <li>Preview to sanity-check.</li>
          <li>Hit <b>Mint Template</b> and approve (on Base).</li>
        </ol>
        <div className="text-xs text-slate-400 mt-2">
          Gas is additional. Mint price pegs to USD at tx time; shown USD is informational.
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            onClick={() => window.open('https://basescan.org', '_blank')}
            className="bg-slate-700 hover:bg-slate-600 text-xs"
          >
            🔎 Explore Base
          </Button>
          <Button
            onClick={() => window.open('https://warpcast.com/~/compose', '_blank')}
            className="bg-purple-600 hover:bg-purple-500 text-xs"
          >
            🌀 Tell friends on Farcaster
          </Button>
        </div>
      </div>
    </div>
  )
}
