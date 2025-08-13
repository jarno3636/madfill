// components/WalletConnectButton.jsx
'use client'

import { useCallback, useMemo } from 'react'
import { useMiniWallet } from '../hooks/useMiniWallet'

export default function WalletConnectButton({
  children,
  className = '',
  onConnected,
  onDisconnected,
  ...props
}) {
  const {
    address,
    isConnected,
    isLoading,
    connect,
    disconnect,
    error,
    isInFarcaster,
  } = useMiniWallet()

  const prettyAddress = useMemo(() => {
    if (!address) return ''
    return `${address.slice(0, 6)}…${address.slice(-4)}`
  }, [address])

  const handleConnect = useCallback(async () => {
    try {
      if (!isConnected) {
        const result = await connect()
        const addr = (result && (result.address || result)) || address
        onConnected && onConnected(addr || null)
      } else {
        await disconnect()
        onDisconnected && onDisconnected()
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Wallet connection error:', e)
    }
  }, [isConnected, connect, disconnect, onConnected, onDisconnected, address])

  const label = useMemo(() => {
    if (isLoading) return 'Connecting…'
    if (isConnected) {
      return children || `Disconnect ${prettyAddress}`
    }
    return children || 'Connect Browser Wallet'
  }, [isLoading, isConnected, children, prettyAddress])

  const errText = (error && (error.shortMessage || error.reason || error.message)) || ''

  // Don't render if Farcaster integration already provides a wallet connection
  if (isInFarcaster && isConnected) {
    return null
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isLoading}
      aria-busy={isLoading ? 'true' : 'false'}
      aria-live="polite"
      className={`
        inline-flex items-center justify-center gap-2
        px-4 py-2 rounded-md text-sm font-medium
        transition-colors duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
        disabled:opacity-50 disabled:cursor-not-allowed
        ${isConnected
          ? 'text-red-800 bg-red-100 hover:bg-red-200 border border-red-300'
          : 'text-white bg-purple-600 hover:bg-purple-700'}
        ${className}
      `}
      title={isConnected ? `Connected: ${prettyAddress}` : 'Connect your wallet'}
      {...props}
    >
      {isLoading && (
        <span
          className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      )}
      <span className="truncate">{label}</span>
      {!!errText && (
        <>
          <span className="ml-1" aria-hidden="true" title={errText}>⚠️</span>
          <span className="sr-only" role="alert">{errText}</span>
        </>
      )}
    </button>
  )
}

export { default as WalletConnectButton } from './WalletConnectButton'
