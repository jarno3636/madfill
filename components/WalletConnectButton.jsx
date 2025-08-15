// components/WalletConnectButton.jsx
'use client'

import { useMemo } from 'react'
import { useWallet } from './WalletProvider'

export default function WalletConnectButton({ className = '', children }) {
  const { isConnected, address, connect, isWarpcast } = useWallet()

  const pretty = useMemo(
    () => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''),
    [address]
  )

  return (
    <button
      type="button"
      onClick={connect}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
        ${isConnected ? 'bg-emerald-700 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
        ${className}
      `}
      title={isConnected ? `Connected: ${pretty}` : (isWarpcast ? 'Connect (Warpcast Mini Wallet)' : 'Connect Wallet')}
    >
      {children || (isConnected ? `Connected ${pretty}` : (isWarpcast ? 'Connect (Warpcast)' : 'Connect Wallet'))}
    </button>
  )
}
