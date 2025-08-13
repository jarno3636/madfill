'use client'
import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'

export default function MiniConnectButton() {
  const [sdk, setSdk] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const detectFarcasterEnv = useCallback(() => {
    if (typeof window === 'undefined') return false
    try {
      return (
        window.location !== window.parent.location ||
        window.location.hostname.includes('warpcast') ||
        (window.navigator.userAgent || '').includes('Farcaster')
      )
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (!detectFarcasterEnv()) return

    import('@farcaster/miniapp-sdk')
      .then(({ default: MiniAppSDK }) => {
        try {
          const miniAppSdk = new MiniAppSDK()
          setSdk(miniAppSdk)

          if (miniAppSdk.isAuthenticated) {
            setUser(miniAppSdk.user)
          }
        } catch (err) {
          console.error('Failed to initialize Farcaster SDK:', err)
          setError('Failed to initialize Farcaster connection')
        }
      })
      .catch(err => {
        console.error('Failed to load Farcaster SDK:', err)
        setError('Farcaster SDK not available')
      })
  }, [detectFarcasterEnv])

  const handleConnect = async () => {
    if (!sdk) return

    setIsLoading(true)
    setError(null)

    try {
      await sdk.authenticate()
      setUser(sdk.user)
    } catch (err) {
      console.error('Farcaster authentication failed:', err)
      setError('Connection failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = () => {
    if (sdk) {
      try {
        sdk.logout()
      } catch (err) {
        console.error('Logout failed:', err)
      }
      setUser(null)
    }
  }

  if (!sdk && !error) return null

  if (error) {
    return (
      <div className="text-xs text-red-400 max-w-32" role="alert">
        {error}
      </div>
    )
  }

  if (user) {
    const avatarSrc = user.pfpUrl || '/default.png'
    const altText = user.displayName || user.username || 'Farcaster user'
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-600/80 rounded-lg border border-purple-500">
        <img
          src={avatarSrc}
          alt={altText}
          className="w-5 h-5 rounded-full"
          onError={e => {
            e.currentTarget.src = '/default.png'
          }}
        />
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-white font-medium truncate">
            {user.displayName || user.username}
          </span>
          {user.displayName && user.username && (
            <span className="text-xs text-purple-200 truncate">
              @{user.username}
            </span>
          )}
        </div>
        <button
          onClick={handleDisconnect}
          className="text-purple-200 hover:text-white text-xs ml-1"
          title="Disconnect"
          aria-label="Disconnect Farcaster"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isLoading}
      className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-2 h-auto"
    >
      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
          <span>Connecting...</span>
        </div>
      ) : (
        'Connect Farcaster'
      )}
    </Button>
  )
}
