// hooks/useMiniAppReady.js
'use client'

import { useEffect, useState } from 'react'

export function useMiniAppReady() {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [isInFarcaster, setIsInFarcaster] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const inWarpcast =
        typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)
      if (!cancelled) setIsInFarcaster(inWarpcast)

      try {
        if (inWarpcast) {
          // Lazy-load the SDK only in the browser + only if inside Warpcast
          const mod = await import('@farcaster/miniapp-sdk')
          const readyFn = mod?.sdk?.ready ?? mod?.sdk?.app?.ready ?? (async () => {})
          await readyFn()
        }
        if (!cancelled) setIsReady(true)
      } catch (err) {
        console.error('Mini App ready failed:', err)
        if (!cancelled) {
          setError(err)
          setIsReady(true) // fall back to standard web
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  return { isReady, error, isInFarcaster }
}
