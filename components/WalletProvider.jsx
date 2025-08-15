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
  ensureBaseChain,
  onAccountsChanged,
  onChainChanged,
  isWarpcast,
  BASE_CHAIN_ID_DEC,
} from '@/lib/wallet'

const WalletCtx = createContext({
  provider: /** @type {ethers.BrowserProvider|null} */(null),
  signer:   /** @type {ethers.Signer|null} */(null),
  address:  /** @type {string|null} */(null),
  chainId:  /** @type {bigint|null} */(null),
  isConnected: false,
  isOnBase: true,
  isWarpcast: false,
  connect: async () => {},
  switchToBase: async () => {},
  refresh: async () => {},
})

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [address, setAddress] = useState(null)
  const [chainId, setChainId] = useState(null)

  const isConnected = !!address
  const isOnBase = chainId === BASE_CHAIN_ID_DEC

  const booted = useRef(false)

  // One-time init: prewarm Mini provider; hydrate provider/signer/address silently when possible
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
        try {
          setChainId(await getChainId())
        } catch {}
      }
    })()
  }, [])

  // Listen for account/chain changes globally
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
    // Only prompts outside Warpcast; inside Mini it resolves silently
    await bp.send('eth_requestAccounts', [])
    setProvider(bp)
    const sg = await bp.getSigner()
    setSigner(sg)
    setAddress(await sg.getAddress())
    setChainId((await bp.getNetwork())?.chainId ?? null)
  }, [])

  const switchToBase = useCallback(async () => {
    const ok = await ensureBaseChain()
    if (ok) {
      try {
        const bp = await getBrowserProvider()
        setProvider(bp)
        setChainId((await bp?.getNetwork())?.chainId ?? null)
      } catch {}
    }
    return ok
  }, [])

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
    isWarpcast: isWarpcast(),
    connect, switchToBase, refresh,
    // exposing a readonly provider can help pages do public reads consistently
    readProvider: getReadonlyProvider(),
  }), [provider, signer, address, chainId, isConnected, isOnBase])

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
}

export const useWallet = () => useContext(WalletCtx)
