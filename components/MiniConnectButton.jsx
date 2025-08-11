// components/MiniConnectButton.jsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMiniWallet } from '@/hooks/useMiniWallet'

export default function MiniConnectButton() {
  // Avoid rendering until after mount to dodge hydration edge cases
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { isWarpcast, ready, address, connect, disconnect, connecting, error } = useMiniWallet()

  if (!mounted || !isWarpcast) return null

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 rounded bg-slate-800/70 border border-slate-700 text-xs">
          👛 {address.slice(0,6)}…{address.slice(-4)}
        </span>
        <Button onClick={disconnect} className="bg-slate-700 hover:bg-slate-600">Disconnect</Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={connect} disabled={!ready || connecting} className="bg-purple-600 hover:bg-purple-500">
        {connecting ? 'Connecting…' : 'Connect (Warpcast)'}
      </Button>
      {error ? <span className="text-xs text-amber-300">{error}</span> : null}
    </div>
  )
}
