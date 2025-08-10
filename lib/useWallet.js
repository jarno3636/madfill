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

  // passive boot: load provider, account, chain
  useEffect(() => {
    if (typeof window === 'undefined') return
    const injected = window.ethereum
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
        const accts = await injected.request?.({ method: 'eth_accounts' })
        if (mounted) setAddress(accts?.[0] || null)

        const net = await p.getNetwork()
        if (mounted) setIsOnBase(net?.chainId === BigInt(BASE_CHAIN_ID_DEC))

        // hydrate signer if already connected
        if (mounted && accts?.[0]) {
          try {
            const s = await p.getSigner()
            setSigner(s)
          } catch {}
        }
      } catch {}
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
      injected.removeListener?.('chainChanged', onChainChanged)
      injected.removeListener?.('accountsChanged', onAccountsChanged)
    }
  }, [])

  const connect = useCallback(async () => {
    setError('')
    if (!window?.ethereum) {
      setError('No injected wallet detected')
      return
    }
    try {
      setConnecting(true)
      const p = new ethers.BrowserProvider(window.ethereum)
      const accts = await p.send('eth_requestAccounts', [])
      const s = await p.getSigner()
      const net = await p.getNetwork()

      setProvider(p)
      setSigner(s)
      setAddress(accts?.[0] || null)
      setIsOnBase(net?.chainId === BigInt(BASE_CHAIN_ID_DEC))
    } catch (e) {
      setError(e?.message || 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    // No programmatic disconnect for injected; clear local state
    setSigner(null)
    setAddress(null)
  }, [])

  const switchToBase = useCallback(async () => {
    setError('')
    if (!window?.ethereum) return false
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
          setIsOnBase(true)
          return true
        } catch (err) {
          setError(err?.message || 'Failed to add Base')
          return false
        }
      }
      setError(e?.message || 'Failed to switch network')
      return false
    }
  }, [])

  const ensureBase = useCallback(async () => {
    if (!provider) return false
    const net = await provider.getNetwork()
    if (net?.chainId === BigInt(BASE_CHAIN_ID_DEC)) return true
    return await switchToBase()
  }, [provider, switchToBase])

  return useMemo(
    () => ({
      address,
      isOnBase,
      provider,
      signer,
      connecting,
      error,
      connect,
      disconnect,
      switchToBase,
      ensureBase,
    }),
    [address, isOnBase, provider, signer, connecting, error, connect, disconnect, switchToBase, ensureBase]
  )
}
