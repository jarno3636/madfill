'use client'
import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

export function useMiniAppReady() {
  useEffect(() => {
    // Call when your page is ready to display
    sdk.actions.ready().catch(() => {})
  }, [])
}
