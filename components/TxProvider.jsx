'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import fillinAbi from '@/abi/FillInStoryV3_ABI.json'
import nftAbi from '@/abi/MadFillTemplateNFT_ABI.json'

/**
 * ENV expected:
 * - NEXT_PUBLIC_FILLIN_ADDRESS
 * - NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS
 * - (optional) NEXT_PUBLIC_BASE_RPC
 */
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID = 8453n
const BASE_CHAIN_ID_HEX = '0x2105'
const EXPLORER = 'https://basescan.org'

const TxContext = createContext(null)

export function TxProvider({ children }) {
  const miniProvRef = useRef(null)

  const [address, setAddress] = useState(null)
  const [provider, setProvider] = useState(null)          // ethers.BrowserProvider | null
  const [signer, setSigner] = useState(null)              // ethers.Signer | null
  const [isOnBase, setIsOnBase] = useState(true)
  const [fillinContract, setFillinContract] = useState(null)
  const [nftContract, setNftContract] = useState(null)

  // ---------- provider detection (Mini first, then injected) ----------
  const getMiniProvider = useCallback(async () => {
    if (miniProvRef.current) return miniProvRef.current
    const inWarpcast = typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent || '')
    if (!inWarpcast) return null
    try {
      const mod = await import('@farcaster/miniapp-sdk')
      const prov = await mod.sdk.wallet.getEthereumProvider()
      miniProvRef.current = prov || null
      return miniProvRef.current
    } catch { return null }
  }, [])

  const getEip1193 = useCallback(async () => {
    const mini = await getMiniProvider()
    if (mini) return mini
    if (typeof window !== 'undefined' && window.ethereum) return window.ethereum
    return null
  }, [getMiniProvider])

  // ---------- base JSON-RPC (read-only) ----------
  const readProvider = useMemo(() => new ethers.JsonRpcProvider(BASE_RPC), [])

  // ---------- boot/hydrate ----------
  useEffect(() => {
    let eip
    let stop = () => {}

    ;(async () => {
      eip = await getEip1193()
      if (!eip) return

      const bp = new ethers.BrowserProvider(eip)
      setProvider(bp)

      // address (silent on Mini; injected returns empty until request)
      try {
        const sg = await bp.getSigner().catch(() => null)
        const a = await sg?.getAddress().catch(() => null)
        if (sg && a) { setSigner(sg); setAddress(a) }
      } catch {}

      try {
        const net = await bp.getNetwork()
        setIsOnBase(net?.chainId === BASE_CHAIN_ID)
      } catch { setIsOnBase(true) }

      // events
      const onAccountsChanged = async (accs) => {
        const a = Array.isArray(accs) && accs[0] ? accs[0] : null
        setAddress(a)
        if (a) {
          try { setSigner(await bp.getSigner()) } catch { setSigner(null) }
        } else {
          setSigner(null)
        }
      }
      const onChainChanged = async () => {
        try {
          const net = await bp.getNetwork()
          setIsOnBase(net?.chainId === BASE_CHAIN_ID)
        } catch { setIsOnBase(true) }
      }
      eip.on?.('accountsChanged', onAccountsChanged)
      eip.on?.('chainChanged', onChainChanged)
      stop = () => {
        eip?.removeListener?.('accountsChanged', onAccountsChanged)
        eip?.removeListener?.('chainChanged', onChainChanged)
      }
    })()

    return () => { try { stop() } catch {} }
  }, [getEip1193])

  // ---------- connect / switch ----------
  const connect = useCallback(async () => {
    const eip = await getEip1193()
    if (!eip) throw new Error('No wallet provider found')
    const bp = new ethers.BrowserProvider(eip)
    await bp.send('eth_requestAccounts', [])
    const sg = await bp.getSigner()
    const a = await sg.getAddress()
    setProvider(bp); setSigner(sg); setAddress(a)
    const net = await bp.getNetwork()
    setIsOnBase(net?.chainId === BASE_CHAIN_ID)
    return a
  }, [getEip1193])

  const ensureBase = useCallback(async () => {
    // In Warpcast Mini, chain is already Base
    const eip = await getEip1193()
    if (!eip?.request) return false
    try {
      await eip.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID_HEX }] })
      setIsOnBase(true)
      return true
    } catch (err) {
      if (err?.code === 4902) {
        try {
          await eip.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: BASE_CHAIN_ID_HEX,
              chainName: 'Base',
              rpcUrls: [BASE_RPC],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: [EXPLORER],
            }],
          })
          setIsOnBase(true)
          return true
        } catch { return false }
      }
      return false
    }
  }, [getEip1193])

  // ---------- (re)create contracts whenever signer changes ----------
  useEffect(() => {
    const FILL = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
    const NFT  = process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS
    if (!FILL || !NFT) return
    if (!signer) {
      // read-only instances for pages that only read
      const fillRead = new ethers.Contract(FILL, fillinAbi, readProvider)
      const nftRead  = new ethers.Contract(NFT,  nftAbi,    readProvider)
      setFillinContract(fillRead)
      setNftContract(nftRead)
      return
    }
    setFillinContract(new ethers.Contract(FILL, fillinAbi, signer))
    setNftContract(new ethers.Contract(NFT,  nftAbi,    signer))
  }, [signer, readProvider])

  // ---------- helpers ----------
  const toWei = (ethNum) => ethers.parseEther(String(Number(ethNum || 0)))

  const preflight = useCallback(async (fn, args, overrides) => {
    try { await fn.staticCall(...args, overrides || {}) } catch { /* ignore; some wallets/mini omit revert data */ }
  }, [])

  const createPool1 = useCallback(async ({
    name, theme, parts, word, username, entryFeeEth, durationDays, blankIndex
  }) => {
    if (!fillinContract || !signer) throw new Error('Wallet not connected')
    if (!isOnBase) {
      const ok = await ensureBase()
      if (!ok) throw new Error('Please switch to Base')
    }
    const fee = toWei(entryFeeEth)
    const duration = BigInt(Math.max(0, Math.floor(Number(durationDays) || 0)) * 86400)
    const idx = Math.max(0, Number(blankIndex) || 0)
    const args = [
      String(name || ''), String(theme || ''), Array.isArray(parts) ? parts.map(String) : [],
      String(word || ''), String(username || ''), fee, duration, idx
    ]
    await preflight(fillinContract.createPool1, args, { value: fee })
    const tx = await fillinContract.createPool1(...args, { value: fee })
    return await tx.wait()
  }, [fillinContract, signer, isOnBase, ensureBase, preflight])

  const joinPool1 = useCallback(async ({
    id, word, username, blankIndex, entryFeeEth
  }) => {
    if (!fillinContract || !signer) throw new Error('Wallet not connected')
    if (!isOnBase) {
      const ok = await ensureBase()
      if (!ok) throw new Error('Please switch to Base')
    }
    const fee = toWei(entryFeeEth)
    const idx = Math.max(0, Number(blankIndex) || 0)
    const args = [BigInt(id), String(word || ''), String(username || ''), idx]
    await preflight(fillinContract.joinPool1, args, { value: fee })
    const tx = await fillinContract.joinPool1(...args, { value: fee })
    return await tx.wait()
  }, [fillinContract, signer, isOnBase, ensureBase, preflight])

  const claimPool1 = useCallback(async (id) => {
    if (!fillinContract || !signer) throw new Error('Wallet not connected')
    if (!isOnBase) {
      const ok = await ensureBase()
      if (!ok) throw new Error('Please switch to Base')
    }
    await preflight(fillinContract.claimPool1, [BigInt(id)])
    const tx = await fillinContract.claimPool1(BigInt(id))
    return await tx.wait()
  }, [fillinContract, signer, isOnBase, ensureBase, preflight])

  // Optional reads (handy for pages)
  const getPool1Info = useCallback(async (id) => {
    if (!fillinContract) throw new Error('Contract not ready')
    const info = await fillinContract.getPool1Info(BigInt(id))
    return {
      name: info.name_ ?? info[0],
      theme: info.theme_ ?? info[1],
      parts: info.parts_ ?? info[2],
      feeBase: info.feeBase_ ?? info[3],
      deadline: Number(info.deadline_ ?? info[4]),
      creator: info.creator_ ?? info[5],
      participants: info.participants_ ?? info[6],
      winner: info.winner_ ?? info[7],
      claimed: info.claimed_ ?? info[8],
      poolBalance: info.poolBalance_ ?? info[9],
    }
  }, [fillinContract])

  const value = useMemo(() => ({
    // state
    address, isOnBase, provider, signer, readProvider,
    // contracts
    fillinContract, nftContract,
    // wallet/chain
    connect, ensureBase,
    // pool helpers
    createPool1, joinPool1, claimPool1, getPool1Info,
  }), [
    address, isOnBase, provider, signer, readProvider,
    fillinContract, nftContract,
    connect, ensureBase,
    createPool1, joinPool1, claimPool1, getPool1Info
  ])

  return <TxContext.Provider value={value}>{children}</TxContext.Provider>
}

export const useTx = () => useContext(TxContext)
