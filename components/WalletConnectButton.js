// components/WalletConnectButton.js
'use client'

import useWallet from '@/lib/useWallet'
import { Button } from '@/components/ui/button'

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''
}

export default function WalletConnectButton() {
  const {
    address,
    isOnBase,
    connecting,
    error,
    connect,
    disconnect,
    switchToBase,
  } = useWallet()

  return (
    <div className="flex items-center gap-2">
      {!address ? (
        <Button
          onClick={connect}
          className="bg-indigo-600 hover:bg-indigo-500"
          disabled={connecting}
        >
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </Button>
      ) : (
        <>
          {!isOnBase && (
            <Button
              onClick={switchToBase}
              className="bg-cyan-700 hover:bg-cyan-600"
              title="Switch to Base"
            >
              Switch to Base
            </Button>
          )}
          <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700 text-xs">
            {shortAddr(address)}
          </span>
          <Button
            onClick={disconnect}
            variant="secondary"
            className="bg-slate-700 hover:bg-slate-600"
            title="Disconnect (clears local state)"
          >
            Disconnect
          </Button>
        </>
      )}
      {error && (
        <span className="text-xs text-amber-300 max-w-[220px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}
