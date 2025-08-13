// hooks/useMiniAppReady.js
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

function detectFarcaster() {
  if (typeof window === 'undefined') return false
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const inWarpcastUA = /Warpcast/i.test(ua)
    const inIframe = window.self !== window.top
    const pathHint = window.location?.pathname?.startsWith?.('/mini')
    return Boolean(inWarpcastUA || inIframe || pathHint)
  } catch {
    return false
  }
}

export function useMiniAppReady() {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [isInFarcaster, setIsInFarcaster] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const inFC = useMemo(detectFarcaster, [])
  useEffect(() => setIsInFarcaster(inFC), [inFC])

  useEffect(() => {
    let timeoutId
    ;(async () => {
      try {
        // Only attempt SDK init in Farcaster environments
        if (inFC && typeof window !== 'undefined') {
          const mod = await import('@farcaster/miniapp-sdk').catch(() => null)

          // Support both shapes:
          // 1) { sdk } singleton
          // 2) default export is a class (MiniAppSDK)
          let sdk = mod?.sdk
          if (!sdk) {
            const Ctor = mod?.default || mod?.MiniAppSDK
            if (typeof Ctor === 'function') {
              try {
                sdk = new Ctor()
              } catch (e) {
                // ignore; fall back to marking ready
              }
            }
          }

          // If there is a ready() method, await it with a timeout
          const readyPromise =
            typeof sdk?.ready === 'function'
              ? sdk.ready()
              : typeof sdk?.actions?.ready === 'function'
              ? sdk.actions.ready()
              : Promise.resolve()

          // 1200ms timeout to avoid hanging UI
          const timeout = new Promise((resolve) => {
            timeoutId = setTimeout(resolve, 1200)
          })

          await Promise.race([readyPromise, timeout])
        }

        if (mountedRef.current) setIsReady(true)
      } catch (err) {
        console.error('MiniApp ready failed:', err)
        if (mountedRef.current) {
          setError(err)
          // Still mark ready so web fallback flows can proceed
          setIsReady(true)
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
      }
    })()
  }, [inFC])

  return { isReady, error, isInFarcaster }
}

export default useMiniAppReady
