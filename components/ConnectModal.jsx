// components/ConnectModal.jsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/lib/useWallet'
import { BASE } from '@/lib/chain'

export default function ConnectModal({ open, onClose }) {
  const [hasInjected, setHasInjected] = useState(false)
  const {
    address, short, connected, isOnBase,
    connectBest, disconnect, ensureBase, connectStatus
  } = useWallet()

  useEffect(() => {
    if (typeof window !== 'undefined') setHasInjected(Boolean(window.ethereum))
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 text-white border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Connect wallet</h3>
          <button onClick={onClose} className="text-slate-300" aria-label="Close">×</button>
        </div>

        {!connected ? (
          <>
            <div className="space-y-2">
              <Button
                onClick={connectBest}
                disabled={connectStatus === 'connecting'}
                className="w-full bg-indigo-600 hover:bg-indigo-500"
              >
                {connectStatus === 'connecting' ? 'Connecting…' : 'Connect'}
              </Button>
            </div>

            {!hasInjected && (
              <p className="text-xs text-slate-400 mt-3">
                Tip: No browser wallet detected. We’ll open WalletConnect for QR / mobile deep link.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-slate-300 break-all">
              Connected: <span className="font-mono">{address}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isOnBase && (
                <Button
                  onClick={ensureBase}
                  className="bg-cyan-700 hover:bg-cyan-600"
                >
                  Switch to {BASE.name}
                </Button>
              )}
              <Button
                onClick={() => { navigator.clipboard?.writeText(address).catch(()=>{}); }}
                className="bg-slate-800 hover:bg-slate-700"
              >
                Copy Address ({short})
              </Button>
              <Button
                onClick={() => { disconnect(); onClose?.() }}
                className="bg-slate-700 hover:bg-slate-600"
              >
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
