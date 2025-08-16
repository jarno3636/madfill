// components/WalletProvider.jsx
'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ethers } from 'ethers'
import {
  initWallet,
  getReadonlyProvider,
  getBrowserProvider,
  getAddress,
  getChainId,
  onAccountsChanged,
  onChainChanged,
  isWarpcast,
  BASE_CHAIN_ID_DEC,
} from '@/lib/wallet'

const WalletCtx = createContext({})

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [address, setAddress] = useState(null)
  const [chainId, setChainId] = useState(null)

  const isConnected = !!address
  const isOnBase = chainId === BASE_CHAIN_ID_DEC
  const warpcast = isWarpcast()
  const booted = useRef(false)

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    ;(async () => {
      try { await initWallet() } catch {}

      const bp = await getBrowserProvider().catch(() => null)
      setProvider(bp)

      if (bp) {
        try {
          const sg = await bp.getSigner().catch(() => null)
          const addr = await sg?.getAddress().catch(() => null)
          if (sg && addr) { setSigner(sg); setAddress(addr) }
        } catch {}
        try { setChainId(await getChainId()) } catch {}
      }
    })()
  }, [])

  useEffect(() => {
    let off1 = () => {}
    let off2 = () => {}
    ;(async () => {
      off1 = await onAccountsChanged(async (a) => {
        setAddress(a)
        if (a && provider) {
          try { setSigner(await provider.getSigner()) } catch { setSigner(null) }
        } else {
          setSigner(null)
        }
      })
      off2 = await onChainChanged(async () => {
        try { setChainId(await getChainId()) } catch { setChainId(null) }
      })
    })()
    return () => { try { off1() } catch {}; try { off2() } catch {} }
  }, [provider])

  const connect = useCallback(async () => {
    const bp = await getBrowserProvider()
    if (!bp) throw new Error('No wallet provider found')

    if (!warpcast) {
      // only prompt outside Warpcast
      await bp.send('eth_requestAccounts', [])
    }

    setProvider(bp)
    const sg = await bp.getSigner()
    setSigner(sg)
    setAddress(await sg.getAddress())
    setChainId((await bp.getNetwork())?.chainId ?? null)
  }, [warpcast])

  const switchToBase = useCallback(async () => {
    if (warpcast) {
      // Warpcast Mini is always Base; nothing to do
      setChainId(BASE_CHAIN_ID_DEC)
      return true
    }
    try {
      const bp = await getBrowserProvider()
      await bp.send('wallet_switchEthereumChain', [{ chainId: '0x2105' }]) // 8453
      setProvider(bp)
      setChainId((await bp.getNetwork())?.chainId ?? null)
      return true
    } catch (err) {
      console.error('switchToBase failed:', err)
      return false
    }
  }, [warpcast])

  const refresh = useCallback(async () => {
    const bp = await getBrowserProvider().catch(() => null)
    setProvider(bp)
    if (bp) {
      try {
        const sg = await bp.getSigner()
        setSigner(sg)
        setAddress(await sg.getAddress())
      } catch { setSigner(null) }
      try { setChainId((await bp.getNetwork())?.chainId ?? null) } catch {}
    }
  }, [])

  const value = useMemo(() => ({
    provider, signer, address, chainId,
    isConnected, isOnBase,
    isWarpcast: warpcast,
    connect, switchToBase, refresh,
    readProvider: getReadonlyProvider(),
  }), [provider, signer, address, chainId, isConnected, isOnBase, warpcast])

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
}

export const useWallet = () => useContext(WalletCtx)
