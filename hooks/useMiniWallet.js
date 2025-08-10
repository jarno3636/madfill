// hooks/useMiniWallet.js
import { useEffect, useMemo, useRef, useState } from 'react'
const BASE_CHAIN_ID = 8453
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

export function useMiniWallet() {
  const [sdk, setSdk] = useState(null)
  const [ready, setReady] = useState(false)
  const [address, setAddress] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const unsubRef = useRef(null)

  const isWarpcast = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    return /Warpcast/i.test(navigator.userAgent)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isWarpcast) return
      try {
        const mod = await import('@farcaster/miniapp-sdk')
        const s = mod?.sdk
        if (!s) return
        await s.ready()
        if (cancelled) return
        setSdk(s); setReady(true)
        const sess = await s.wallet.getSession()
        if (sess?.address) setAddress(sess.address)
        unsubRef.current = s.wallet.subscribe((evt) => {
          if (evt?.address !== undefined) setAddress(evt.address || null)
        })
      } catch {}
    })()
    return () => {
      cancelled = true
      if (unsubRef.current) try { unsubRef.current() } catch {}
    }
  }, [isWarpcast])

  const connect = async () => {
    if (!sdk || connecting) return null
    setConnecting(true)
    try {
      const sess = await sdk.wallet.connect({ chainId: BASE_CHAIN_ID, rpcUrl: BASE_RPC })
      if (sess?.address) setAddress(sess.address)
      return sess
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    if (!sdk) return
    try { await sdk.wallet.disconnect() } finally { setAddress(null) }
  }

  return { isWarpcast, ready, address, connect, disconnect, connecting }
}
