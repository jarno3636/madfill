import { useState, useEffect } from 'react'
import { miniApp } from '@farcaster/miniapp-sdk'

export function useMiniAppReady() {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [isInFarcaster, setIsInFarcaster] = useState(false)

  useEffect(() => {
    async function initializeMiniApp() {
      try {
        // Check if we're in a Farcaster environment
        const inFarcaster = typeof window !== 'undefined' && 
          (window.parent !== window || window.location !== window.parent.location)

        setIsInFarcaster(inFarcaster)

        if (inFarcaster) {
          // We're in Farcaster - initialize the Mini App SDK
          await miniApp.ready()
          setIsReady(true)
          console.log('Farcaster Mini App SDK initialized successfully')
        } else {
          // Development mode - simulate ready state
          console.log('Development mode: MiniApp SDK not available, using fallback')
          setIsReady(true)
        }
      } catch (err) {
        console.error('Failed to initialize Mini App:', err)
        setError(err)
        // Still set ready to true for development/fallback
        setIsReady(true)
      }
    }

    initializeMiniApp()
  }, [])

  return { isReady, error, isInFarcaster }
}