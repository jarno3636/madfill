// hooks/useMiniAppReady.js
'use client'

import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

export function useMiniAppReady() {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [isInFarcaster, setIsInFarcaster] = useState(false)

  useEffect(() => {
    const inWarpcast =
      typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent);
    setIsInFarcaster(inWarpcast)

    (async () => {
      try {
        if (inWarpcast) {
          await sdk.ready()
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
