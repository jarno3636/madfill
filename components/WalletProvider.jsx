'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ethers } from 'ethers'
import {
  initWallet,
  getReadonlyProvider,
  getBrowserProvider,
  // getAddress, // not needed here
  // getChainId, // we'll read from provider to ensure bigint
  ensureBaseChain,
  onAccountsChanged,
  onChainChanged,
  isWarpcast,
  BASE_CHAIN_ID_DEC,
} from '@/lib/wallet'

// Normalize chain id types to bigint
const BASE_CHAIN_ID_BI = typeof BASE_CHAIN_ID_DEC === 'bigint'
  ? BASE_CHAIN_ID_DEC
  : BigInt(BASE_CHAIN_ID_DEC || 8453)

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
  const [chainId, setChainId] = useState/** @type {bigint|null} */(null)

  const isConnected = !!address
  const isOnBase = chainId != null && chainId === BASE_CHAIN_ID_BI

  const booted = useRef(false)

  // Small helper to read chainId as bigint from a provider
  const readChainIdBI = useCallback(async (bp) => {
    try {
      // ethers v6 returns bigint here
      const net = await bp.getNetwork()
      if (net?.chainId != null) return /** @type {bigint} */(net.chainId)
    } catch {}
    try {
      // fallback to hex RPC
      const hex = await bp.send?.('eth_chainId', [])
      if (typeof hex === 'string' && hex.startsWith('0x')) return BigInt(hex)
    } catch {}
    return null
  }, [])

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

        const cid = await readChainIdBI(bp)
        if (cid != null) setChainId(cid)
      }
    })()
  }, [readChainIdBI])

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
        if (provider) {
          const cid = await readChainIdBI(provider)
          setChainId(cid)
        } else {
          setChainId(null)
        }
      })
    })()
    return () => { try { off1() } catch {}; try { off2() } catch {} }
  }, [provider, readChainIdBI])

  const connect = useCallback(async () => {
    const bp = await getBrowserProvider()
    if (!bp) throw new Error('No wallet provider found')
    // Only prompts outside Warpcast; inside Mini it resolves silently
    await bp.send('eth_requestAccounts', [])
    setProvider(bp)
    const sg = await bp.getSigner()
    setSigner(sg)
    setAddress(await sg.getAddress())
    const cid = await (async () => {
      try { const net = await bp.getNetwork(); return /** @type {bigint} */(net.chainId) } catch {}
      try { const hex = await bp.send('eth_chainId', []); return BigInt(hex) } catch {}
      return null
    })()
    setChainId(cid)
  }, [])

  const switchToBase = useCallback(async () => {
    // In Warpcast, the mini-wallet is already on Base and cannot switch
    if (isWarpcast()) {
      return true
    }
    const ok = await ensureBaseChain()
    if (ok) {
      try {
        const bp = await getBrowserProvider()
        setProvider(bp)
        const cid = await readChainIdBI(bp)
        setChainId(cid)
      } catch {}
    }
    return ok
  }, [readChainIdBI])

  const refresh = useCallback(async () => {
    const bp = await getBrowserProvider().catch(() => null)
    setProvider(bp)
    if (bp) {
      try {
        const sg = await bp.getSigner()
        setSigner(sg)
        setAddress(await sg.getAddress())
      } catch { setSigner(null) }
      const cid = await readChainIdBI(bp)
      setChainId(cid)
    }
  }, [readChainIdBI])

  const value = useMemo(() => ({
    provider, signer, address, chainId,
    isConnected, isOnBase,
    isWarpcast: isWarpcast(),
    connect, switchToBase, refresh,
    // read-only public provider for app reads
    readProvider: getReadonlyProvider(),
  }), [provider, signer, address, chainId, isConnected, isOnBase])

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
}

export const useWallet = () => useContext(WalletCtx)
