import { useState, useEffect, useCallback } from 'react'
import { miniApp } from '@farcaster/miniapp-sdk'

export function useMiniWallet() {
  const [address, setAddress] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isInFarcaster, setIsInFarcaster] = useState(false)

  useEffect(() => {
    // Check if we're in Farcaster environment
    const inFarcaster = typeof window !== 'undefined' && 
      (window.parent !== window || window.location !== window.parent.location)
    
    setIsInFarcaster(inFarcaster)
    checkConnection()
  }, [])

  const checkConnection = useCallback(async () => {
    try {
      if (isInFarcaster) {
        // We're in Farcaster environment - use Mini App SDK
        const connected = await miniApp.wallet.isConnected()
        if (connected) {
          const walletAddress = await miniApp.wallet.getAddress()
          setAddress(walletAddress)
          setIsConnected(true)
        }
      } else {
        // Development mode - check for browser wallet or mock connection
        if (typeof window !== 'undefined' && window.ethereum) {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          if (accounts?.[0]) {
            setAddress(accounts[0])
            setIsConnected(true)
          }
        } else {
          // Use mock wallet for development
          const mockAddress = localStorage.getItem('mock_wallet_address')
          if (mockAddress) {
            setAddress(mockAddress)
            setIsConnected(true)
          }
        }
      }
    } catch (err) {
      console.error('Error checking wallet connection:', err)
      setError(err)
    }
  }, [isInFarcaster])

  const connect = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (isInFarcaster) {
        // We're in Farcaster environment - use Mini App SDK
        const walletAddress = await miniApp.wallet.connect()
        setAddress(walletAddress)
        setIsConnected(true)
        console.log('Farcaster wallet connected:', walletAddress)
      } else {
        // Development mode - try browser wallet first, then fallback to mock
        if (typeof window !== 'undefined' && window.ethereum) {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
          if (accounts?.[0]) {
            setAddress(accounts[0])
            setIsConnected(true)
            console.log('Browser wallet connected:', accounts[0])
          }
        } else {
          // Mock wallet for development
          const mockAddress = '0x1234567890123456789012345678901234567890'
          localStorage.setItem('mock_wallet_address', mockAddress)
          setAddress(mockAddress)
          setIsConnected(true)
          console.log('Mock wallet connected:', mockAddress)
        }
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err)
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [isInFarcaster])

  const disconnect = useCallback(async () => {
    try {
      if (isInFarcaster) {
        // We're in Farcaster environment - use Mini App SDK
        await miniApp.wallet.disconnect()
        console.log('Farcaster wallet disconnected')
      } else {
        // Development mode cleanup
        localStorage.removeItem('mock_wallet_address')
        console.log('Development wallet disconnected')
      }

      setAddress(null)
      setIsConnected(false)
      setError(null)
    } catch (err) {
      console.error('Failed to disconnect wallet:', err)
      setError(err)
    }
  }, [isInFarcaster])

  return {
    address,
    isConnected,
    isLoading,
    error,
    isInFarcaster,
    connect,
    disconnect,
    checkConnection
  }
}