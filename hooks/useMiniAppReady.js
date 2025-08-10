// hooks/useMiniAppReady.js
'use client'
import { useEffect } from 'react'

export function useMiniAppReady() {
  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        // Only run inside Warpcast Mini App (cheap check)
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
        if (!/Warpcast/i.test(ua)) return

        // Lazy-load so Node/SSR never touches the module
        const { sdk } = await import('@farcaster/miniapp-sdk')

        if (!mounted) return
        // Fire-and-forget is fine; no need to await
        sdk.actions.ready?.()
      } catch {
        // ignore: will fail outside Warpcast or if SDK unavailable
      }
    })()

    return () => { mounted = false }
  }, [])
}
