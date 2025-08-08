// components/ConnectBar.jsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/lib/useWallet'
import { BASE } from '@/lib/chain'

export default function ConnectBar({ className = '' }) {
  const [busy, setBusy] = useState(false)
  const {
    address, short, connected, isOnBase,
    connectBest, disconnect, ensureBase, connectStatus
  } = useWallet()

  async function handleConnect() {
    try {
      setBusy(true)
      await connectBest()
    } finally {
      setBusy(false)
    }
  }

  async function handleSwitch() {
    try {
      setBusy(true)
      await ensureBase()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!connected ? (
        <Button onClick={handleConnect} disabled={busy} className="bg-indigo-600 hover:bg-indigo-500">
          {busy || connectStatus === 'connecting' ? 'Connecting…' : 'Connect Wallet'}
        </Button>
      ) : (
        <>
          {!isOnBase && (
            <Button onClick={handleSwitch} disabled={busy} className="bg-cyan-700 hover:bg-cyan-600">
              Switch to {BASE.name}
            </Button>
          )}
          <span className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700 text-xs text-white">
            {short}
          </span>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(address)
              } catch {}
            }}
            className="text-xs underline text-slate-300"
          >
            Copy
          </button>
          <Button onClick={() => disconnect()} variant="ghost" className="text-xs text-slate-300">
            Disconnect
          </Button>
        </>
      )}
    </div>
  )
}
