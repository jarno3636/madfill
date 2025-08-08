// components/InfoMintCard.jsx
import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { Button } from '@/components/ui/button'
import NFT_ABI from '@/abi/MadFillTemplateNFT_ABI.json'

export default function InfoMintCard({ contractAddress }) {
  const [ethWei, setEthWei] = useState(null)
  const [usdE6, setUsdE6] = useState(null)
  const [royaltyBps, setRoyaltyBps] = useState(null)
  const [payout, setPayout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!contractAddress) return
    ;(async () => {
      setLoading(true)
      setErr('')
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(contractAddress, NFT_ABI, provider)

        const [wei, priceE6, bps, wallet] = await Promise.all([
          ct.getMintPriceWei(),
          ct.mintPriceUsdE6(),
          ct.DEFAULT_ROYALTY_BPS(),
          ct.payoutWallet()
        ])

        setEthWei(wei)
        setUsdE6(priceE6)
        setRoyaltyBps(Number(bps))
        setPayout(wallet)
      } catch (e) {
        console.warn('InfoMintCard error', e)
        setErr('Could not fetch live mint info')
      } finally {
        setLoading(false)
      }
    })()
  }, [contractAddress])

  const priceEthStr = ethWei ? ethers.formatEther(ethWei) : null
  const priceUsdStr = usdE6 != null ? (Number(usdE6) / 1_000_000).toFixed(2) : null
  const humanWallet = payout
    ? `${payout.slice(0, 6)}…${payout.slice(-4)}`
    : '—'

  return (
    <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/60 border border-indigo-700/60 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-bold">ℹ️ What’s this page?</h3>
        <span className="text-xs text-indigo-200">
          Contract: <code className="font-mono">{contractAddress || '—'}</code>
        </span>
      </div>

      <p className="text-sm text-indigo-100 mt-2">
        Create your own **MadFill template** (title, theme, and parts with blanks like <span className="font-mono">____</span>),
        then mint it as an NFT on **Base**. You keep authorship onchain; anyone can remix your vibe in-game.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mt-4">
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-300">Mint Price</p>
          <p className="text-base font-mono">
            {loading ? '…' : priceEthStr ? `${Number(priceEthStr).toFixed(5)} ETH` : '—'}
          </p>
          <p className="text-xs text-slate-400">
            {loading ? '' : priceUsdStr ? `≈ $${priceUsdStr} USD (via Chainlink)` : 'USD peg unavailable'}
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-300">Royalty (ERC-2981)</p>
          <p className="text-base font-mono">{loading ? '…' : royaltyBps != null ? `${(royaltyBps / 100).toFixed(2)}%` : '—'}</p>
          <p className="text-xs text-slate-400">Set by the contract for secondary sales</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-300">Payout Wallet</p>
          <p className="text-sm font-mono">{loading ? '…' : humanWallet}</p>
          <p className="text-xs text-slate-400">Primary mint funds are sent here</p>
        </div>
      </div>

      {err && <p className="mt-2 text-xs text-red-200">⚠️ {err}</p>}

      <div className="mt-5 bg-slate-800/60 border border-slate-700 rounded-lg p-4">
        <h4 className="font-semibold mb-1">How to mint</h4>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-200">
          <li>Write a catchy title + short description.</li>
          <li>Pick a theme and add sentence parts. Use <span className="font-mono">____</span> for blanks.</li>
          <li>Click <b>Preview</b> to sanity check.</li>
          <li>Hit <b>Mint Template</b> and approve in your wallet (on Base).</li>
        </ol>
        <div className="text-xs text-slate-400 mt-2">
          Gas fees are additional. Mint price pegs to USD via Chainlink at tx time; the displayed USD is informational.
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
