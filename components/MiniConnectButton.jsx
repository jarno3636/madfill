// components/MiniConnectButton.jsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { Button } from './ui/button'

export default function MiniConnectButton() {
  const [sdk, setSdk] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const inMini = useCallback(() => {
    if (typeof navigator === 'undefined') return false
    return /Warpcast/i.test(navigator.userAgent || '')
  }, [])

  useEffect(() => {
    if (!inMini()) return
    (async () => {
      try {
        const mod = await import('@farcaster/miniapp-sdk')
        const inst = mod?.sdk || mod?.default || null
        if (!inst) throw new Error('MiniApp SDK not available')
        setSdk(inst)
        if (inst.isAuthenticated) setUser(inst.user || null)
      } catch (e) {
        setError('Farcaster SDK not available')
      }
    })()
  }, [inMini])

  const connect = async () => {
    if (!sdk) return
    setLoading(true); setError(null)
    try {
      await sdk.authenticate()
      setUser(sdk.user || null)
    } catch (e) {
      setError('Farcaster auth failed')
    } finally { setLoading(false) }
  }

  const disconnect = () => {
    try { sdk?.logout?.() } catch {}
    setUser(null)
  }

  if (!inMini()) return null
  if (error) return <span className="text-xs text-red-400">{error}</span>

  if (user) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-600/80 rounded-lg border border-purple-500">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user?.pfpUrl || '/default.png'} alt={user?.username || 'user'} className="w-5 h-5 rounded-full" />
        <span className="text-xs">{user?.displayName || user?.username || 'Connected'}</span>
        <button onClick={disconnect} className="text-xs text-purple-200 ml-1">×</button>
      </div>
    )
  }

  return (
    <Button onClick={connect} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-2 h-auto">
      {loading ? 'Connecting…' : 'Connect Farcaster'}
    </Button>
  )
}
