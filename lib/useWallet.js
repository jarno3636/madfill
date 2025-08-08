// lib/useWallet.js
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { BASE } from './chain'

/** Singleton Web3Modal (client-side only) */
let _modal = null
function getWeb3Modal() {
  if (typeof window === 'undefined') return null
  if (_modal) return _modal
  _modal = new Web3Modal({
    cacheProvider: true,
    providerOptions: {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          rpc: { [BASE.chainIdDec]: BASE.rpcUrl },
          chainId: BASE.chainIdDec,
        },
      },
    },
  })
  return _modal
}

export function useWallet() {
  const [address, setAddress] = useState(null)
  const [provider, setProvider] = useState(null)     // ethers.BrowserProvider
  const [signer, setSigner] = useState(null)         // ethers.Signer
  const [isOnBase, setIsOnBase] = useState(true)
  const [connectStatus, setConnectStatus] = useState('idle') // idle|connecting|connected|error
  const instanceRef = useRef(null) // web3modal provider instance

  const short = useMemo(
    () => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''),
    [address]
  )
  const connected = !!address

  const ensureBase = useCallback(async () => {
    const eth = instanceRef.current || (typeof window !== 'undefined' ? window.ethereum : null)
    if (!eth?.request) return false
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE.chainIdHex }],
      })
      setIsOnBase(true)
      return true
    } catch (e) {
      // Need to add chain?
      if (e?.code === 4902 || String(e?.message || '').toLowerCase().includes('unrecognized chain')) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: BASE.chainIdHex,
              chainName: BASE.name,
              rpcUrls: [BASE.rpcUrl],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: [BASE.explorer],
            }],
          })
          setIsOnBase(true)
          return true
        } catch (err) {
          console.error('add chain failed', err)
          return false
        }
      }
      console.error('switch chain failed', e)
      return false
    }
  }, [])

  const readNetwork = useCallback(async (_provider) => {
    try {
      const net = await _provider.getNetwork()
      setIsOnBase(net?.chainId === BigInt(BASE.chainIdDec))
    } catch {
      setIsOnBase(true)
    }
  }, [])

  const connectInjected = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return null
    await window.ethereum.request?.({ method: 'eth_requestAccounts' })
    instanceRef.current = window.ethereum
    return window.ethereum
  }, [])

  const connectBest = useCallback(async () => {
    try {
      setConnectStatus('connecting')

      // Prefer injected
      let ethLike = await connectInjected()
      if (!ethLike) {
        // fallback to Web3Modal
        const modal = getWeb3Modal()
        const instance = await modal.connect()
        instanceRef.current = instance
        ethLike = instance
      }

      // Force Base (add/switch)
      await ensureBase()

      const browserProvider = new ethers.BrowserProvider(ethLike)
      setProvider(browserProvider)
      await readNetwork(browserProvider)

      const s = await browserProvider.getSigner()
      const a = await s.getAddress()
      setSigner(s)
      setAddress(a)
      setConnectStatus('connected')
      return a
    } catch (e) {
      console.error('connectBest error', e)
      setConnectStatus('error')
      throw e
    }
  }, [connectInjected, ensureBase, readNetwork])

  const disconnect = useCallback(async () => {
    try {
      const modal = getWeb3Modal()
      await modal?.clearCachedProvider()
    } catch {}
    try {
      await instanceRef.current?.disconnect?.()
    } catch {}
    instanceRef.current = null
    setAddress(null)
    setSigner(null)
    setProvider(null)
    setConnectStatus('idle')
  }, [])

  // Auto-connect if cached or injected has an address
  useEffect(() => {
    if (typeof window === 'undefined') return
    const modal = getWeb3Modal()
    const injectedHasAddr = !!window.ethereum?.selectedAddress
    if (modal?.cachedProvider || injectedHasAddr) {
      connectBest().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen to account / chain changes
  useEffect(() => {
    const eth = instanceRef.current || (typeof window !== 'undefined' ? window.ethereum : null)
    if (!eth?.on) return
    const onAccounts = async (accs) => {
      const a = Array.isArray(accs) ? accs[0] : null
      if (!a) {
        await disconnect()
      } else {
        setAddress(a)
      }
    }
    const onChain = async () => {
      if (!provider) return
      await readNetwork(provider)
    }
    eth.on('accountsChanged', onAccounts)
    eth.on('chainChanged', onChain)
    return () => {
      try {
        eth.removeListener?.('accountsChanged', onAccounts)
        eth.removeListener?.('chainChanged', onChain)
      } catch {}
    }
  }, [provider, readNetwork, disconnect])

  return {
    // state
    address,
    short,
    connected,
    isOnBase,
    provider,
    signer,
    connectStatus,
    // actions
    connectBest,
    disconnect,
    ensureBase,
  }
}
