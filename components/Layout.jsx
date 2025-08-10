// components/MiniConnectButton.jsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ethers } from 'ethers'

const BASE_CHAIN_ID_DEC = 8453n
const BASE_CHAIN_ID_HEX = '0x2105'

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''
}

export default function MiniConnectButton() {
  const [isWarpcast, setIsWarpcast] = useState(false)
  const [provider, setProvider] = useState(null) // EIP-1193 from miniapp-sdk
  const [address, setAddress] = useState('')
  const [chainOk, setChainOk] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  // Detect Warpcast only on client (avoids SSR issues)
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    setIsWarpcast(/Warpcast/i.test(navigator.userAgent))
  }, [])

  // Connect (or rehydrate) to Mini App provider
  const connect = async () => {
    setError('')
    setConnecting(true)
    try {
      const mod = await import('@farc
