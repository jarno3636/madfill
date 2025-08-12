'use client'
import { useState, useEffect } from 'react'
import { Button } from './ui/button'

export default function MiniConnectButton() {
  const [sdk, setSdk] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Only load SDK in Farcaster environment
    if (typeof window === 'undefined') return
    
    const isFarcaster = window.location !== window.parent.location || 
                       window.location.hostname.includes('warpcast') ||
                       window.navigator.userAgent.includes('Farcaster')
    
    if (!isFarcaster) return

    import('@farcaster/miniapp-sdk').then(({ default: MiniAppSDK }) => {
      try {
        const miniAppSdk = new MiniAppSDK()
        setSdk(miniAppSdk)
        
        // Check if already authenticated
        if (miniAppSdk.isAuthenticated) {
          setUser(miniAppSdk.user)
        }
      } catch (err) {
        console.error('Failed to initialize Farcaster SDK:', err)
        setError('Failed to initialize Farcaster connection')
      }
    }).catch(err => {
      console.error('Failed to load Farcaster SDK:', err)
      setError('Farcaster SDK not available')
    })
  }, [])

  const handleConnect = async () => {
    if (!sdk) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      await sdk.authenticate()
      setUser(sdk.user)
    } catch (error) {
      console.error('Farcaster authentication failed:', error)
      setError('Connection failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = () => {
    if (sdk) {
      sdk.logout()
      setUser(null)
    }
  }

  // Don't render if SDK not available
  if (!sdk && !error) return null

  if (error) {
    return (
      <div className="text-xs text-red-400 max-w-32">
        {error}
      </div>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-600/80 rounded-lg border border-purple-500">
        <img 
          src={user.pfpUrl || '/default.png'} 
          alt={user.displayName || user.username}
          className="w-5 h-5 rounded-full"
          onError={(e) => {
            e.target.src = '/default.png'
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
          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Connecting...</span>
        </div>
      ) : (
        'Connect Farcaster'
      )}
    </Button>
  )
}