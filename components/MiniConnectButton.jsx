// hooks/useMiniWallet.js
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useMiniWallet() {
  const [isWarpcast, setIsWarpcast] = useState(false)
  const [ready, setReady] = useState(false)          // mini-app SDK ready
  const [connecting, setConnecting] = useState(false)
  const [address, setAddress] = useState('')
  const providerRef = useRef(null)
  const listenersBoundRef = useRef(false)

  // Detect Warpcast (client-only) and mark ready() when SDK loads
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)) {
          setIsWarpcast(true)
          // lazy-load to avoid SSR build touching the module
          const mod = await import('@farcaster/miniapp-sdk')
          if (!mounted) return
          // tell Warpcast we’re ready (safe if called multiple times)
          try { await mod.sdk.actions.ready?.() } catch {}
          if (mounted) setReady(true)
        } else {
          setIsWarpcast(false)
          setReady(false)
        }
      } catch {
        if (mounted) {
          setIsWarpcast(false)
          setReady(false)
        }
      }
    })()
    return () => { mounted = false }
  }, [])

  // Connect using the Mini App EIP-1193 provider
  const connect = useCallback(async () => {
    if (!isWarpcast) return
    setConnecting(true)
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk')
      // ensure ready (no-op if already)
      try { await sdk.actions.ready?.() } catch {}

      const provider = await sdk.wallet.getEthereumProvider() // EIP-1193
      providerRef.current = provider

      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      setAddress(accounts?.[0] || '')

      // Bind listeners once
      if (!listenersBoundRef.current && provider.on) {
        const onAccountsChanged = (accs) => setAddress(accs?.[0] || '')
        const onDisconnect = () => setAddress('')
        provider.on('accountsChanged', onAccountsChanged)
        provider.on('disconnect', onDisconnect)
        listenersBoundRef.current = true
      }
    } finally {
      setConnecting(false)
    }
  }, [isWarpcast])

  // “Disconnect” is just clearing local state (mini provider doesn’t truly disconnect)
  const disconnect = useCallback(() => {
    setAddress('')
  }, [])

  return {
    isWarpcast,
    ready,
    address,
    connect,
    disconnect,
    connecting,
    // optionally expose the raw provider for tx calls on pages:
    provider: providerRef.current,
  }
}
