// hooks/useMiniAppReady.js
'use client'

import { useEffect, useState } from 'react'

export function useMiniAppReady() {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [isInFarcaster, setIsInFarcaster] = useState(false)

  useEffect(() => {
    const inWarpcast =
      typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)
    setIsInFarcaster(inWarpcast)

    ;(async () => {
      try {
        if (inWarpcast && typeof window !== 'undefined') {
          // ⬇️ import ONLY on the client, only in Warpcast
          const mod = await import('@farcaster/miniapp-sdk')
          await mod.sdk.ready()
        }
        setIsReady(true)
      } catch (err) {
        console.error('Mini App ready failed:', err)
        setError(err)
        setIsReady(true) // allow web fallback
      }
    })()
  }, [])

  return { isReady, error, isInFarcaster }
}
