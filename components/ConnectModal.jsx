// components/ConnectModal.jsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchNetwork } from 'wagmi'
import { base } from 'wagmi/chains'
import { Button } from '@/components/ui/button'

export default function ConnectModal({ open, onClose }) {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { connectors, connect, isLoading: isConnecting, pendingConnector, error } = useConnect()
  const { switchNetwork, isLoading: isSwitching } = useSwitchNetwork()
  const [hasInjected, setHasInjected] = useState(false)

  useEffect(() => setHasInjected(Boolean(window?.ethereum)), [])

  // Prefer WalletConnect on mobile if no injection
  const sorted = useMemo(() => {
    const wc = connectors.find(c => c.id?.toLowerCase().includes('walletconnect'))
    const coinbase = connectors.find(c => c.id?.toLowerCase().includes('coinbase'))
    const injected = connectors.find(c => c.id?.toLowerCase().includes('injected'))
    const farcaster = connectors.find(c => c.id?.toLowerCase().includes('farcaster'))

    // order by UX priority for regular web
    const list = [injected, coinbase, wc, farcaster].filter(Boolean)
    // if no injected, put WC first (QR/deeplink works everywhere)
    if (!hasInjected && wc) return [wc, coinbase, farcaster, injected].filter(Boolean)
    return list
  }, [connectors, hasInjected])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 text-white border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Connect wallet</h3>
          <button onClick={onClose} className="text-slate-300">&times;</button>
        </div>

        {isConnected ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-300 break-all">Connected: {address}</div>
            <div className="flex gap-2">
              <Button
                onClick={() => switchNetwork?.(base.id)}
                disabled={isSwitching}
                className="bg-cyan-700 hover:bg-cyan-600"
              >
                {isSwitching ? 'Switching…' : 'Switch to Base'}
              </Button>
              <Button onClick={() => { disconnect(); onClose?.() }} className="bg-slate-700 hover:bg-slate-600">
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {sorted.map((c) => (
                <Button
                  key={c.id}
                  onClick={() => connect({ connector: c, chainId: base.id })}
                  disabled={isConnecting && pendingConnector?.id === c.id}
                  className="w-full bg-indigo-600 hover:bg-indigo-500"
                >
                  {isConnecting && pendingConnector?.id === c.id ? 'Connecting…' : `Connect with ${c.name}`}
                </Button>
              ))}
            </div>

            {!hasInjected && (
              <p className="text-xs text-slate-400 mt-3">
                Tip: No browser wallet detected. We recommend WalletConnect for a quick QR or mobile deep link.
              </p>
            )}
            {error && <div className="text-xs text-amber-300 mt-2">{error?.shortMessage || error?.message}</div>}
          </>
        )}
      </div>
    </div>
  )
}
