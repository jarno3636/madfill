// hooks/useMiniAppReady.js
'use client'
import { useEffect } from 'react'
import { sdk } from '@farcaster/frame-sdk'

export function useMiniAppReady() {
  useEffect(() => {
    sdk.actions.ready().catch(() => {})
  }, [])
}
