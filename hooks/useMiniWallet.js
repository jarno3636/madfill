// hooks/useMiniWallet.js
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useMiniWallet() {
  const mounted = useRef(false)
  const [isWarpcast, setIsWarpcast] = useState(false)
  const [ready, setReady] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [address, setAddress] = useState(null)
  const [provider, setProvider] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    mounted.current = true
    ;(async () => {
      try {
        // Never touch the SDK at module scope; detect client/UA first
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
        const inWarpcast = /Warpcast/i.test(ua)
        if (!mounted.current) return
        setIsWarpcast(inWarpcast)

        if (!inWarpcast) {
          // Not in Warpcast → do nothing; this hook becomes a no-op
          setReady(false)
          return
        }

        // Lazy import only inside Warpcast
        let sdk
        try {
          const mod = await import('@farcaster/frame-sdk')
          sdk = mod?.sdk
        } catch {
          // Older examples used miniapp-sdk; try it as a fallback
          try {
            const mod = await import('@farcaster/miniapp-sdk')
            sdk = mod?.sdk || mod?.default?.sdk || mod
          } catch {}
        }

        if (!mounted.current) return
        if (!sdk) {
          setError('Farcaster SDK unavailable')
          setReady(false)
          return
        }

        // Signal ready (best-effort)
        try { await sdk.actions?.ready?.() } catch {}

        setReady(true)
      } catch {
        if (mounted.current) {
          setReady(false)
          setError('Init failed')
        }
      }
    })()
    return () => { mounted.current = false }
  }, [])

  const connect = useCallback(async () => {
    if (!isWarpcast) return
    setError('')
    setConnecting(true)
    try {
      // Prefer miniapp provider via frame-sdk
      let sdk
      try {
        const mod = await import('@farcaster/frame-sdk')
        sdk = mod?.sdk
      } catch {
        const mod = await import('@farcaster/miniapp-sdk')
        sdk = mod?.sdk || mod?.default?.sdk || mod
      }
      if (!sdk) throw new Error('SDK not available')

      const eip1193 = await sdk.wallet.getEthereumProvider()
      // Some clients need enable/requestAccounts
      try { await eip1193.request?.({ method: 'eth_requestAccounts' }) } catch {}

      const accounts = await eip1193.request?.({ method: 'eth_accounts' })
      const addr = Array.isArray(accounts) ? accounts[0] : null
      if (!mounted.current) return
      setProvider(eip1193)
      setAddress(addr)
    } catch (e) {
      if (!mounted.current) return
      setError(e?.message || 'Connect failed')
    } finally {
      if (mounted.current) setConnecting(false)
    }
  }, [isWarpcast])

  const disconnect = useCallback(() => {
    // There’s no programmatic disconnect for the mini provider;
    // clear local state so UI reflects "disconnected".
    setAddress(null)
    setProvider(null)
  }, [])

  return { isWarpcast, ready, connecting, address, provider, connect, disconnect, error }
}
