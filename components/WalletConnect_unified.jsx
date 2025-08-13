'use client'

import { useState, useCallback, useMemo } from 'react'
import { useFarcaster } from './FarcasterProvider_unified'
import { useMiniWallet } from '../CLEANED_hooks/useMiniWallet_unified'

export default function WalletConnect() {
  const { user, isAuthenticated, signIn } = useFarcaster()
  const { address, isConnected, connect } = useMiniWallet()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  const prettyAddress = useMemo(() => {
    if (!address) return ''
    return `${address.slice(0, 6)}…${address.slice(-4)}`
  }, [address])

  const handleConnect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      if (!isAuthenticated) {
        await signIn()
      }
      await connect()
    } catch (err) {
      console.error('Connection failed:', err)
      setError(err?.message || 'Failed to connect wallet')
    } finally {
      setConnecting(false)
    }
  }, [isAuthenticated, signIn, connect])

  if (isConnected && isAuthenticated) {
    return (
      <div className="flex items-center space-x-3">
        {user?.pfpUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.pfpUrl}
            alt={`${user?.username || 'Profile'} avatar`}
            className="w-8 h-8 rounded-full"
            onError={(e) => {
              if (e?.currentTarget) {
                e.currentTarget.src = '/default.png'
              }
            }}
          />
        )}
        <div className="text-sm">
          <div className="text-green-400 font-semibold">Connected</div>
          <div className="text-gray-300">
            {user?.username || prettyAddress}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-6 rounded-full transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
      >
        {connecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
      {error && (
        <span className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
