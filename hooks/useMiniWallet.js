// hooks/useMiniWallet.js
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ethers } from 'ethers'

const BASE_CHAIN_ID = 8453n
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_EXPLORER = 'https://basescan.org'

function detectFarcaster() {
  if (typeof window === 'undefined') return false
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const inWarpcastUA = /Warpcast/i.test(ua)
    const inIframe = window.self !== window.top
    const pathHint = window.location?.pathname?.startsWith?.('/mini')
    return Boolean(inWarpcastUA || inIframe || pathHint)
  } catch {
    return false
  }
}

async function getMiniappEip1193() {
  // Dynamically import to avoid SSR touching the SDK
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    // support both shapes: sdk singleton, or class constructor
    const sdkInst =
      mod?.sdk ??
      (typeof (mod?.default || mod?.MiniAppSDK) === 'function'
        ? new (mod.default || mod.MiniAppSDK)()
        : null)
    const prov = await sdkInst?.wallet?.getEthereumProvider?.()
    return prov || null
  } catch {
    return null
  }
}

export function useMiniWallet() {
  const [address, setAddress] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isInFarcaster, setIsInFarcaster] = useState(false)

  const mountedRef = useRef(true)
  const miniProvRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    setIsInFarcaster(detectFarcaster())
    return () => {
      mountedRef.current = false
    }
  }, [])

  const getMiniProvider = useCallback(async () => {
    if (miniProvRef.current) return miniProvRef.current
    if (!detectFarcaster()) return null
    const prov = await getMiniappEip1193()
    miniProvRef.current = prov
    return prov
  }, [])

  // Provider detection order: MiniApp → injected
  const getEip1193 = useCallback(async () => {
    const mini = await getMiniProvider()
    if (mini) return mini
    if (typeof window !== 'undefined' && window.ethereum) return window.ethereum
    return null
  }, [getMiniProvider])

  // Passive observe + attach listeners (with cleanup)
  useEffect(() => {
    let eip = null

    const onAccountsChanged = (accs) => {
      if (!mountedRef.current) return
      const a = accs?.[0] || null
      setAddress(a)
      setIsConnected(!!a)
    }
    const onChainChanged = () => {
      // no-op here; connect() handles enforcement
    }

    ;(async () => {
      eip = await getEip1193()
      if (!eip) return

      try {
        const provider = new ethers.BrowserProvider(eip)
        const signer = await provider.getSigner().catch(() => null)
        const addr = await signer?.getAddress().catch(() => null)
        if (mountedRef.current && addr) {
          setAddress(addr)
          setIsConnected(true)
        }
      } catch (e) {
        if (mountedRef.current) setError(e)
      }

      if (eip?.on) {
        eip.on('accountsChanged', onAccountsChanged)
        eip.on('chainChanged', onChainChanged)
      }
    })()

    return () => {
      if (eip?.removeListener) {
        eip.removeListener('accountsChanged', onAccountsChanged)
        eip.removeListener('chainChanged', onChainChanged)
      }
    }
  }, [getEip1193])

  const connect = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const eip = await getEip1193()
      if (!eip) throw new Error('No wallet provider found (MiniApp or injected)')

      // Request accounts
      await eip.request?.({ method: 'eth_requestAccounts' })

      const provider = new ethers.BrowserProvider(eip)
      const net = await provider.getNetwork()

      // Enforce Base chain (8453)
      if (net?.chainId !== BASE_CHAIN_ID) {
        const chainIdHex = `0x${BASE_CHAIN_ID.toString(16)}`
        try {
          await eip.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
          })
        } catch (err) {
          if (err?.code === 4902) {
            await eip.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: chainIdHex,
                  chainName: 'Base',
                  rpcUrls: [BASE_RPC],
                  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                  blockExplorerUrls: [BASE_EXPLORER],
                },
              ],
            })
          } else {
            const msg = err?.shortMessage || err?.reason || err?.message || 'Chain switch failed'
            throw new Error(msg)
          }
        }
      }

      const signer = await provider.getSigner()
      const addr = await signer.getAddress()
      if (mountedRef.current) {
        setAddress(addr)
        setIsConnected(true)
      }
      return addr
    } catch (e) {
      if (mountedRef.current) setError(e)
      throw e
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [getEip1193])

  const disconnect = useCallback(async () => {
    // No standard EIP-1193 way to "disconnect"; just clear local state
    if (!mountedRef.current) return
    setAddress(null)
    setIsConnected(false)
    setError(null)
  }, [])

  return { address, isConnected, isLoading, connect, disconnect, error, isInFarcaster }
}

export default useMiniWallet
