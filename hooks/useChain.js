// hooks/useChain.js
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ethers } from 'ethers'

/**
 * Base chain constants (Ethers v6-friendly).
 */
export const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
export const BASE_CHAIN_ID = 8453n
export const BASE_CHAIN_ID_HEX = '0x2105'

/**
 * SSR-safe detection of the best available EIP-1193 provider.
 * Priority: Warpcast MiniApp > injected (window.ethereum).
 */
async function detectEip1193(miniRef) {
  // Injected
  if (typeof window !== 'undefined' && window.ethereum) return window.ethereum

  // Warpcast Mini
  if (miniRef.current) return miniRef.current
  const inWarpcast =
    typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent || '')
  if (!inWarpcast) return null
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    const prov = await mod.sdk.wallet.getEthereumProvider()
    miniRef.current = prov
    return prov
  } catch {
    return null
  }
}

/**
 * Request a chain switch to Base; if missing, attempt to add it.
 */
async function requestBaseSwitch(eip) {
  if (!eip) throw new Error('Wallet provider not available')
  try {
    await eip.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    })
    return true
  } catch (err) {
    // 4902: Unrecognized chain — try adding
    if (err && (err.code === 4902 || err.code === '4902')) {
      await eip.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base',
            rpcUrls: [BASE_RPC],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://basescan.org'],
          },
        ],
      })
      return true
    }
    throw err
  }
}

/**
 * A small, focused chain hook used by ChainSwitcher and pages.
 * Exposes:
 *  - address
 *  - isOnBase
 *  - switchToBase()
 *  - provider (ethers.BrowserProvider | null)
 */
export function useChain() {
  const miniRef = useRef(null)
  const [address, setAddress] = useState(null)
  const [isOnBase, setIsOnBase] = useState(true)
  const [provider, setProvider] = useState(null)

  // Observe wallet + chain
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const eip = await detectEip1193(miniRef)
      if (!eip) {
        if (!cancelled) {
          setProvider(null)
          setAddress(null)
          setIsOnBase(true) // neutral default
        }
        return
      }

      const p = new ethers.BrowserProvider(eip)
      if (!cancelled) setProvider(p)

      try {
        const accts = await eip.request?.({ method: 'eth_accounts' }).catch(() => [])
        if (!cancelled) setAddress(accts?.[0] || null)
      } catch {
        if (!cancelled) setAddress(null)
      }

      try {
        const net = await p.getNetwork()
        if (!cancelled) setIsOnBase(net?.chainId === BASE_CHAIN_ID)
      } catch {
        if (!cancelled) setIsOnBase(true)
      }

      // Event listeners
      const onChain = () => {
        // Re-check chain quickly without a full reload
        p.getNetwork()
          .then((net) => setIsOnBase(net?.chainId === BASE_CHAIN_ID))
          .catch(() => setIsOnBase(true))
      }
      const onAcct = (accs) => setAddress(accs?.[0] || null)

      eip.on?.('chainChanged', onChain)
      eip.on?.('accountsChanged', onAcct)
      return () => {
        eip.removeListener?.('chainChanged', onChain)
        eip.removeListener?.('accountsChanged', onAcct)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const switchToBase = useCallback(async () => {
    const eip = provider ? provider.provider : await detectEip1193(miniRef)
    await requestBaseSwitch(eip)
    // after switching, refresh state
    if (provider) {
      try {
        const net = await provider.getNetwork()
        setIsOnBase(net?.chainId === BASE_CHAIN_ID)
      } catch {
        setIsOnBase(true)
      }
    }
  }, [provider])

  return { address, isOnBase, switchToBase, provider }
}

export default useChain
