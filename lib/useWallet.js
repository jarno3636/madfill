// lib/useWallet.js
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { BASE_CHAIN_ID_DEC, BASE_CHAIN_ID_HEX, ADD_BASE_PARAMS } from '@/lib/chain'

export default function useWallet() {
  const [address, setAddress] = useState(null)
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [isOnBase, setIsOnBase] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  // boot: passive read of accounts + chain
  useEffect(() => {
    if (!window?.ethereum) return

    const p = new ethers.BrowserProvider(window.ethereum)
    setProvider(p)

    let mounted = true
    ;(async () => {
      try {
        const accts = await window.ethereum.request({ method: 'eth_accounts' })
        if (mounted) setAddress(accts?.[0] || null)
      } catch {}

      try {
        const net = await p.getNetwork()
        if (mounted) setIsOnBase(net?.chainId === BigInt(BASE_CHAIN_ID_DEC))
      } catch {}
    })()

    const onChainChanged = async () => {
      try {
        const net = await p.getNetwork()
        setIsOnBase(net?.chainId === BigInt(BASE_CHAIN_ID_DEC))
      } catch {
        setIsOnBase(false)
      }
    }
    const onAccountsChanged = (accs) => setAddress(accs?.[0] || null)

    window.ethereum.on?.('chainChanged', onChainChanged)
    window.ethereum.on?.('accountsChanged', onAccountsChanged)

    return () => {
      mounted = false
      window.ethereum.removeListener?.('chainChanged', onChainChanged)
      window.ethereum.removeListener?.('accountsChanged', onAccountsChanged)
    }
  }, [])

  const connect = useCallback(async () => {
    setError('')
    if (!window?.ethereum) {
      setError('No wallet detected')
      return
    }
    try {
      setConnecting(true)
      const p = new ethers.BrowserProvider(window.ethereum)
      const accts = await p.send('eth_requestAccounts', [])
      const s = await p.getSigner()
      const net = await p.getNetwork()

      setProvider(p)
      setSigner(s)
      setAddress(accts?.[0] || null)
      setIsOnBase(net?.chainId === BigInt(BASE_CHAIN_ID_DEC))
    } catch (e) {
      setError(e?.message || 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    // For injected providers there is no programmatic disconnect;
    // we clear local state so UI returns to “disconnected”.
    setSigner(null)
    setAddress(null)
  }, [])

  const switchToBase = useCallback(async () => {
    setError('')
    if (!window?.ethereum) return
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      })
      setIsOnBase(true)
      return true
    } catch (e) {
      // if chain is not added
      if (e?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ADD_BASE_PARAMS],
          })
          setIsOnBase(true)
          return true
        } catch (err) {
          setError(err?.message || 'Failed to add Base')
          return false
        }
      }
      setError(e?.message || 'Failed to switch network')
      return false
    }
  }, [])

  const ensureBase = useCallback(async () => {
    if (!provider) return false
    const net = await provider.getNetwork()
    if (net?.chainId === BigInt(BASE_CHAIN_ID_DEC)) return true
    return await switchToBase()
  }, [provider, switchToBase])

  const value = useMemo(
    () => ({
      address,
      isOnBase,
      provider,
      signer,
      connecting,
      error,
      connect,
      disconnect,
      switchToBase,
      ensureBase,
    }),
    [address, isOnBase, provider, signer, connecting, error, connect, disconnect, switchToBase, ensureBase]
  )

  return value
}
