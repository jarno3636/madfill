// lib/useWallet.js
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { BASE_CHAIN_ID_DEC, BASE_CHAIN_ID_HEX, ADD_BASE_PARAMS } from '@/lib/chain'

export default function useWallet() {
  const [address, setAddress] = useState(null)
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [isOnBase, setIsOnBase] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [isInjected, setIsInjected] = useState(false)

  // passive boot: load provider, account, chain
  useEffect(() => {
    if (typeof window === 'undefined') return
    const injected = window.ethereum
    setIsInjected(!!injected)

    if (!injected) {
      // Helpful hint if running inside Warpcast (no injected wallet there)
      const ua = navigator?.userAgent || ''
      if (/Warpcast/i.test(ua)) {
        setError('In Warpcast, use the “Connect (Warpcast)” button.')
      }
      return
    }

    const p = new ethers.BrowserProvider(injected)
    setProvider(p)

    let mounted = true
    ;(async () => {
      try {
        const accts = await injected.request?.({ method: 'eth_accounts' }).catch(() => [])
        if (mounted) setAddress(accts?.[0] || null)

        try {
          const net = await p.getNetwork()
          if (mounted) setIsOnBase(net?.chainId === BigInt(BASE_CHAIN_ID_DEC))
        } catch {
          if (mounted) setIsOnBase(false)
        }

        // hydrate signer if already connected
        if (mounted && accts?.[0]) {
          try {
            const s = await p.getSigner()
            setSigner(s)
          } catch {
            setSigner(null)
          }
        }
      } catch {
        // ignore passive failures
      }
    })()

    const onChainChanged = async () => {
      try {
        const net = await p.getNetwork()
        setIsOnBase(net?.chainId === BigInt(BASE_CHAIN_ID_DEC))
      } catch {
        setIsOnBase(false)
      }
    }
    const onAccountsChanged = async (accs) => {
      const a = accs?.[0] || null
      setAddress(a)
      if (a) {
        try {
          const s = await p.getSigner()
          setSigner(s)
        } catch {
          setSigner(null)
        }
      } else {
        setSigner(null)
      }
    }

    injected.on?.('chainChanged', onChainChanged)
    injected.on?.('accountsChanged', onAccountsChanged)

    return () => {
      mounted = false
      // defensively support both removeListener and off
      if (injected?.removeListener) {
        injected.removeListener('chainChanged', onChainChanged)
        injected.removeListener('accountsChanged', onAccountsChanged)
      } else if (injected?.off) {
        injected.off('chainChanged', onChainChanged)
        injected.off('accountsChanged', onAccountsChanged)
      }
    }
  }, [])

  const connect = useCallback(async () => {
    setError('')
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No injected wallet detected')
      return null
    }
    try {
      setConnecting(true)
      const p = new ethers.BrowserProvider(window.ethereum)
      const accts = await p.send('eth_requestAccounts', [])
      const s = await p.getSigner()
      const net = await p.getNetwork()

      setProvider(p)
      setSigner(s)
      const addr = accts?.[0] || null
      setAddress(addr)
      setIsOnBase(net?.chainId === BigInt(BASE_CHAIN_ID_DEC))
      return addr
    } catch (e) {
      const msg = e?.shortMessage || e?.reason || e?.message || 'Connection failed'
      setError(msg)
      return null
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    // No programmatic disconnect for injected; clear local state
    setSigner(null)
    setAddress(null)
    setIsOnBase(false)
    setError('')
  }, [])

  const switchToBase = useCallback(async () => {
    setError('')
    if (typeof window === 'undefined' || !window.ethereum) return false
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      })
      setIsOnBase(true)
      return true
    } catch (e) {
      if (e?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ADD_BASE_PARAMS],
          })
          // attempt switch again after adding
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID_HEX }],
          })
          setIsOnBase(true)
          return true
        } catch (err) {
          const msg = err?.shortMessage || err?.reason || err?.message || 'Failed to add/switch to Base'
          setError(msg)
          return false
        }
      }
      const msg = e?.shortMessage || e?.reason || e?.message || 'Failed to switch network'
      setError(msg)
      return false
    }
  }, [])

  const ensureBase = useCallback(async () => {
    if (!provider) return false
    try {
      const net = await provider.getNetwork()
      if (net?.chainId === BigInt(BASE_CHAIN_ID_DEC)) return true
    } catch {
      // fall through to switch
    }
    return await switchToBase()
  }, [provider, switchToBase])

  const isConnected = !!address

  return useMemo(
    () => ({
      address,
      isOnBase,
      isInjected,
      isConnected,
      provider,
      signer,
      connecting,
      error,
      connect,
      disconnect,
      switchToBase,
      ensureBase,
    }),
    [address, isOnBase, isInjected, isConnected, provider, signer, connecting, error, connect, disconnect, switchToBase, ensureBase]
  )
}
