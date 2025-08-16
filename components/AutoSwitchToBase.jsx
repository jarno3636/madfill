'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@/components/WalletProvider'

const BASE_CHAIN_HEX = '0x2105' // 8453
const BASE_PARAMS = {
  chainId: BASE_CHAIN_HEX,
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
}

export default function AutoSwitchToBase({ showBanner = true }) {
  const { connect, isOnBase, switchToBase, address, provider } = useWallet()
  const [error, setError] = useState(null)
  const [attempted, setAttempted] = useState(false)

  // 1) On mount: connect + switch
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setError(null)
        await connect()               // no-op if already connected
        // Try your wallet helper first
        const ok = await switchToBase()
        if (!ok && typeof window !== 'undefined' && window.ethereum) {
          // Fallback to raw EIP-3326 + EIP-3085
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: BASE_CHAIN_HEX }],
            })
          } catch (e) {
            // If chain is unknown to the wallet, add it, then switch
            if (e?.code === 4902) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [BASE_PARAMS],
              })
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BASE_CHAIN_HEX }],
              })
            } else {
              throw e
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not switch to Base')
      } finally {
        if (!cancelled) setAttempted(true)
      }
    })()
    return () => { cancelled = true }
  }, [connect, switchToBase])

  // 2) Retry whenever tab regains focus (mini apps often fail first try)
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        setError(null)
        await connect()
        await switchToBase()
      } catch (e) {
        setError(e?.message || 'Could not switch to Base')
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [connect, switchToBase])

  if (!showBanner) return null

  // Soft banner only if we tried and still not on Base
  if (attempted && !isOnBase) {
    return (
      <div className="mx-auto mt-3 max-w-3xl rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200 text-sm">
        You’re not on <b>Base</b>. I tried to switch your wallet automatically.
        If you don’t see a wallet prompt, open this page in your wallet’s browser
        (e.g. Coinbase Wallet) and try again. {error ? <span className="opacity-80">({error})</span> : null}
      </div>
    )
  }
  return null
}
