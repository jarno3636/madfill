'use client'
import { useEffect } from 'react'

export function useMiniAppReady() {
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Lazy-load so SSR/build never touches the module
        const mod = await import('@farcaster/frame-sdk')
        if (!mounted) return
        await mod.sdk.actions.ready()
      } catch {
        // ignore – works only inside Warpcast Mini Apps
      }
    })()
    return () => { mounted = false }
  }, [])
}
