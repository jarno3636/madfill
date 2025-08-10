// hooks/useMiniWallet.js
'use client'

import { useEffect, useState } from 'react'

export function useMiniAppEthereum() {
  const [provider, setProvider] = useState<any>(null)
  const [isMiniApp, setIsMiniApp] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // lightweight detection (UA + SDK context)
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
        const looksLikeWarpcast = /Warpcast/i.test(ua)

        if (looksLikeWarpcast) {
          const { sdk } = await import('@farcaster/miniapp-sdk')
          setIsMiniApp(true)

          // signal ready (optional but recommended)
          try { sdk.actions.ready?.() } catch {}

          // request the Mini App Ethereum provider
          const miniProv = await sdk.wallet.getEthereumProvider() // returns EIP-1193 provider
          if (mounted) setProvider(miniProv)
          return
        }

        // Fallback: injected wallet in browser
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          setProvider((window as any).ethereum)
        } else {
          setProvider(null)
        }
      } catch {
        setProvider(null)
      }
    })()

    return () => { mounted = false }
  }, [])

  return { provider, isMiniApp }
}
