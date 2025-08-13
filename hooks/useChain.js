// hooks/useChain.js
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { FARCASTER_CONFIG, getChainInfo } from '../lib/farcasterConfig'
import { useMiniWallet } from './useMiniWallet'

/**
 * Chain / network management hook
 * - Uses EIP-1193 provider if present
 * - Numeric chainId throughout (e.g., 8453)
 * - Safe on SSR and during unmount
 */
export function useChain() {
  const { isConnected } = useMiniWallet()
  const mountedRef = useRef(false)

  const [currentChainId, setCurrentChainId] = useState(
    FARCASTER_CONFIG.defaultChainId
  )
  const [isCorrectChain, setIsCorrectChain] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [lastError, setLastError] = useState(null)

  const provider = useMemo(
    () => (typeof window !== 'undefined' ? window.ethereum : undefined),
    []
  )

  const supportedIds = useMemo(
    () => FARCASTER_CONFIG.supportedChains.map((c) => c.id),
    []
  )

  const setChainState = useCallback(
    (numericId) => {
      setCurrentChainId(numericId)
      setIsCorrectChain(supportedIds.includes(numericId))
    },
    [supportedIds]
  )

  const checkCurrentChain = useCallback(async () => {
    if (!provider?.request) return
    try {
      const chainIdHex = await provider.request({ method: 'eth_chainId' })
      const numeric = parseInt(String(chainIdHex), 16)
      if (!mountedRef.current) return
      setChainState(numeric)
      setLastError(null)
    } catch (e) {
      if (!mountedRef.current) return
      console.error('useChain: checkCurrentChain failed:', e)
      setLastError(e)
    }
  }, [provider, setChainState])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Initial / reactive checks
  useEffect(() => {
    if (isConnected) checkCurrentChain()
  }, [isConnected, checkCurrentChain])

  // Listen for provider events
  useEffect(() => {
    if (!provider?.on) return

    const onChainChanged = (hex) => {
      const id = parseInt(String(hex), 16)
      setChainState(id)
    }
    const onAccountsChanged = () => {
      // Accounts change often coincides with network context changes
      checkCurrentChain()
    }

    provider.on('chainChanged', onChainChanged)
    provider.on('accountsChanged', onAccountsChanged)

    return () => {
      try {
        provider.removeListener?.('chainChanged', onChainChanged)
        provider.removeListener?.('accountsChanged', onAccountsChanged)
      } catch {}
    }
  }, [provider, setChainState, checkCurrentChain])

  const switchToChain = useCallback(
    async (targetChainId) => {
      if (!provider?.request) {
        const err = new Error('No wallet provider found')
        setLastError(err)
        throw err
      }

      const info = getChainInfo(targetChainId)
      if (!info) {
        const err = new Error(`Unsupported chain ID: ${targetChainId}`)
        setLastError(err)
        throw err
      }

      setSwitching(true)
      setLastError(null)

      const hexChainId = `0x${Number(targetChainId).toString(16)}`

      try {
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hexChainId }],
          })
        } catch (err) {
          // 4902 = chain not added to wallet
          if (err?.code === 4902) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: hexChainId,
                  chainName: info.name,
                  rpcUrls: [info.rpcUrl],
                  blockExplorerUrls: [info.blockExplorer],
                  nativeCurrency: info.nativeCurrency,
                },
              ],
            ])
          } else {
            throw err
          }
        }

        if (!mountedRef.current) return
        setChainState(targetChainId)
      } catch (e) {
        if (!mountedRef.current) return
        console.warn('useChain: switchToChain failed:', e)
        // Normalize a readable message
        const reason = e?.data?.message || e?.message || 'Failed to switch chain'
        setLastError(new Error(reason))
        throw e
      } finally {
        if (mountedRef.current) setSwitching(false)
      }
    },
    [provider, setChainState]
  )

  const switchToDefaultChain = useCallback(
    () => switchToChain(FARCASTER_CONFIG.defaultChainId),
    [switchToChain]
  )

  const refresh = useCallback(() => checkCurrentChain(), [checkCurrentChain])

  return {
    // state
    currentChainId,
    currentChain: getChainInfo(currentChainId),
    isCorrectChain,
    switching,
    lastError,

    // constants
    supportedChains: FARCASTER_CONFIG.supportedChains,

    // actions
    switchToChain,
    switchToDefaultChain,
    checkCurrentChain: refresh,
    refresh,
  }
}
