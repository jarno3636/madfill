// /components/WalletProvider.jsx
'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import { getEip1193, getBrowserProvider, getChainId, ensureBaseChain, BASE_CHAIN_ID, isWarpcast } from '@/lib/wallet'

const Ctx = createContext({
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
  const isOnBase = chainId === BASE_CHAIN_ID

  const initOnce = useRef(false)

  // Init (auto-signer in Warpcast; no prompt on web until connect())
  const init = useCallback(async () => {
    const bp = await getBrowserProvider().catch(() => null)
    setProvider(bp)
    if (bp) {
      // Silent signer/address if available (Mini App provides it)
      try {
        const sg = await bp.getSigner().catch(() => null)
        const addr = await sg?.getAddress().catch(() => null)
        if (sg && addr) { setSigner(sg); setAddress(addr) }
      } catch {}
      setChainId(await getChainId(bp))
    }
  }, [])

  useEffect(() => {
    if (initOnce.current) return
    initOnce.current = true
    init()
  }, [init])

  // React to wallet events
  useEffect(() => {
    let eip; let cleanup = () => {}
    ;(async () => {
      eip = await getEip1193()
      if (!eip?.on) return
      const onAccountsChanged = async (accs) => {
        const next = Array.isArray(accs) && accs[0] ? accs[0] : null
        setAddress(next)
        if (next && provider) setSigner(await provider.getSigner())
      }
      const onChainChanged = async () => {
        const bp = await getBrowserProvider().catch(() => null)
        setProvider(bp)
        setChainId(await getChainId(bp))
      }
      eip.on('accountsChanged', onAccountsChanged)
      eip.on('chainChanged', onChainChanged)
      cleanup = () => {
        eip?.removeListener?.('accountsChanged', onAccountsChanged)
        eip?.removeListener?.('chainChanged', onChainChanged)
      }
    })()
    return () => cleanup()
  }, [provider])

  const connect = useCallback(async () => {
    const eip = await getEip1193()
    if (!eip) throw new Error('No wallet provider found.')
    await eip.request?.({ method: 'eth_requestAccounts' }) // web only prompts; Mini App is silent
    const bp = await getBrowserProvider()
    setProvider(bp)
    const sg = await bp.getSigner()
    setSigner(sg)
    setAddress(await sg.getAddress())
    setChainId(await getChainId(bp))
  }, [])

  const switchToBase = useCallback(async () => {
    const eip = await getEip1193()
    await ensureBaseChain(eip)
    const bp = await getBrowserProvider()
    setProvider(bp)
    setChainId(await getChainId(bp))
  }, [])

  const refresh = useCallback(async () => {
    const bp = await getBrowserProvider().catch(() => null)
    setProvider(bp)
    if (bp) {
      setChainId(await getChainId(bp))
      try {
        const sg = await bp.getSigner()
        setSigner(sg)
        setAddress(await sg.getAddress())
      } catch {}
    }
  }, [])

  const value = useMemo(() => ({
    provider, signer, address, chainId,
    isConnected, isOnBase,
    isWarpcast: isWarpcast(),
    connect, switchToBase, refresh,
  }), [provider, signer, address, chainId, isConnected, isOnBase, connect, switchToBase, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useWallet = () => useContext(Ctx)
