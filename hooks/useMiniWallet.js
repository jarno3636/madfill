'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ethers } from 'ethers'

const BASE_CHAIN_ID = 8453n
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID_HEX = '0x2105'

export function useMiniWallet() {
  const [address, setAddress] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const miniProvRef = useRef(null)

  const getMiniProvider = useCallback(async () => {
    if (miniProvRef.current) return miniProvRef.current
    if (typeof window === 'undefined') return null
    const inWarpcast = typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)
    if (!inWarpcast) return null
    try {
      const mod = await import('@farcaster/miniapp-sdk')
      const prov = await mod.sdk.wallet.getEthereumProvider()
      miniProvRef.current = prov || null
      return miniProvRef.current
    } catch {
      return null
    }
  }, [])

  const getEip1193 = useCallback(async () => {
    if (typeof window !== 'undefined' && window.ethereum) return window.ethereum
    return await getMiniProvider()
  }, [getMiniProvider])

  // passive observe + attach listeners (with proper cleanup)
  useEffect(() => {
    let cancelled = false
    let eip = null
    const acctHandler = (accs) => {
      const a = accs?.[0] || null
      setAddress(a)
      setIsConnected(!!a)
    }
    const chainHandler = () => { /* noop */ }

    ;(async () => {
      eip = await getEip1193()
      if (!eip) return

      try {
        const provider = new ethers.BrowserProvider(eip)
        const signer = await provider.getSigner().catch(() => null)
        const addr = await signer?.getAddress().catch(() => null)
        if (!cancelled && addr) {
          setAddress(addr)
          setIsConnected(true)
        }
      } catch {}

      if (eip?.on) {
        eip.on('accountsChanged', acctHandler)
        eip.on('chainChanged', chainHandler)
      }
    })()

    return () => {
      cancelled = true
      if (eip?.removeListener) {
        eip.removeListener('accountsChanged', acctHandler)
        eip.removeListener('chainChanged', chainHandler)
      }
    }
  }, [getEip1193])

  const connect = useCallback(async () => {
    setIsLoading(true)
    try {
      const eip = await getEip1193()
      if (!eip) throw new Error('No wallet found')

      await eip.request?.({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(eip)
      const net = await provider.getNetwork()
      if (net?.chainId !== BASE_CHAIN_ID) {
        try {
          await eip.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID_HEX }],
          })
        } catch (e) {
          if (e?.code === 4902) {
            await eip.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: BASE_CHAIN_ID_HEX,
                chainName: 'Base',
                rpcUrls: [BASE_RPC],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                blockExplorerUrls: ['https://basescan.org'],
              }],
            })
          } else {
            throw e
          }
        }
      }
      const signer = await provider.getSigner()
      const addr = await signer.getAddress()
      setAddress(addr)
      setIsConnected(true)
      return addr
    } finally {
      setIsLoading(false)
    }
  }, [getEip1193])

  const disconnect = useCallback(async () => {
    setAddress(null)
    setIsConnected(false)
  }, [])

  return { address, isConnected, isLoading, connect, disconnect }
}
