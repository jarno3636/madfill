'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ethers } from 'ethers'
import fillinAbi from '@/abi/FillInStoryV3_ABI.json'
import nftAbi from '@/abi/MadFillTemplateNFT_ABI.json'

const BASE_CHAIN_ID = 8453n
const BASE_CHAIN_ID_HEX = '0x2105'
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

const FILLIN_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F4AF8E0c'

const TxContext = createContext(null)

function isWarpcastUA() {
  if (typeof navigator === 'undefined') return false
  return /Warpcast/i.test(navigator.userAgent || '')
}

async function getMiniProviderIfAny() {
  if (!isWarpcastUA()) return null
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    const prov = await mod.sdk.wallet.getEthereumProvider()
    return prov || null
  } catch {
    return null
  }
}

export function TxProvider({ children }) {
  const mounted = useRef(false)
  const [provider, setProvider] = useState(null) // ethers.BrowserProvider | null
  const [signer, setSigner] = useState(null)     // ethers.Signer | null
  const [address, setAddress] = useState(null)   // string | null
  const [isOnBase, setIsOnBase] = useState(true) // Base by default for Mini
  const [error, setError] = useState(null)

  // Init best EIP-1193 (Mini first, then injected)
  const bootstrap = useCallback(async (requestAccounts = false) => {
    setError(null)
    try {
      let eip = await getMiniProviderIfAny()
      if (!eip && typeof window !== 'undefined' && window.ethereum) {
        eip = window.ethereum
      }
      if (!eip) {
        setProvider(null); setSigner(null); setAddress(null)
        setIsOnBase(true) // neutral
        return null
      }

      const bp = new ethers.BrowserProvider(eip)
      if (requestAccounts) {
        try { await eip.request?.({ method: 'eth_requestAccounts' }) } catch {}
      }
      const sg = await bp.getSigner().catch(() => null)
      const addr = await sg?.getAddress().catch(() => null)
      const net = await bp.getNetwork().catch(() => null)

      if (!mounted.current) return null
      setProvider(bp)
      setSigner(sg)
      setAddress(addr || null)
      setIsOnBase(net?.chainId === BASE_CHAIN_ID)
      return bp
    } catch (e) {
      if (mounted.current) setError(e)
      return null
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    bootstrap(false)
    return () => { mounted.current = false }
  }, [bootstrap])

  // Listen for account / chain changes
  useEffect(() => {
    let eip
    ;(async () => {
      eip = await getMiniProviderIfAny()
      if (!eip && typeof window !== 'undefined') eip = window.ethereum
      if (!eip?.on) return
      const onAcct = async (accs) => {
        const a = Array.isArray(accs) && accs[0] ? accs[0] : null
        setAddress(a)
        if (a && provider) setSigner(await provider.getSigner().catch(() => null))
      }
      const onChain = async () => {
        try {
          const net = await provider?.getNetwork()
          setIsOnBase(net?.chainId === BASE_CHAIN_ID)
        } catch { setIsOnBase(true) }
      }
      eip.on('accountsChanged', onAcct)
      eip.on('chainChanged', onChain)
      return () => {
        eip?.removeListener?.('accountsChanged', onAcct)
        eip?.removeListener?.('chainChanged', onChain)
      }
    })()
  }, [provider])

  const connect = useCallback(async () => {
    await bootstrap(true)
    return address
  }, [bootstrap, address])

  const switchToBase = useCallback(async () => {
    // Mini apps are already on Base
    if (isWarpcastUA()) { setIsOnBase(true); return true }
    try {
      const eip = provider ? provider.provider : (typeof window !== 'undefined' ? window.ethereum : null)
      if (!eip) throw new Error('No wallet provider found')
      try {
        await eip.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_CHAIN_ID_HEX }],
        })
      } catch (err) {
        if (err?.code === 4902) {
          await eip.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: BASE_CHAIN_ID_HEX,
              chainName: 'Base',
              rpcUrls: [BASE_RPC],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: ['https://basescan.org'],
            }],
          })
        } else {
          throw err
        }
      }
      const net = await provider?.getNetwork().catch(() => null)
      setIsOnBase(net?.chainId === BASE_CHAIN_ID)
      return true
    } catch (e) {
      setError(e); return false
    }
  }, [provider])

  // -------- Contracts (writer preferred, else read) --------
  const getContracts = useCallback(async (needsSigner = true) => {
    // Always have a read provider
    const read = new ethers.JsonRpcProvider(BASE_RPC)
    const withSigner = provider && signer && (await provider.getNetwork()).chainId === BASE_CHAIN_ID

    const fillin = new ethers.Contract(
      FILLIN_ADDRESS,
      fillinAbi,
      (needsSigner && withSigner) ? signer : read
    )
    const nft = new ethers.Contract(
      NFT_ADDRESS,
      nftAbi,
      (needsSigner && withSigner) ? signer : read
    )
    return { fillin, nft }
  }, [provider, signer])

  // -------- Tx helpers with preflight + friendly errors --------
  const errMsg = (e, fb) =>
    e?.info?.error?.message || e?.shortMessage || e?.reason || e?.message || fb

  const createPool1 = useCallback(async ({
    title, theme, parts, word, username, feeBaseWei, durationSecs, blankIndex
  }) => {
    if (!provider) await bootstrap(true)
    const ok = await switchToBase()
    if (!ok) throw new Error('Please switch to Base.')

    const { fillin } = await getContracts(true)
    // Static call = early revert reason
    await fillin.createPool1.staticCall(
      String(title || ''),
      String(theme || ''),
      Array.isArray(parts) ? parts.map(String) : [],
      String(word || ''),
      String(username || ''),
      feeBaseWei,
      BigInt(durationSecs || 0n),
      Number(blankIndex || 0),
      { value: feeBaseWei }
    )
    const tx = await fillin.createPool1(
      String(title || ''),
      String(theme || ''),
      Array.isArray(parts) ? parts.map(String) : [],
      String(word || ''),
      String(username || ''),
      feeBaseWei,
      BigInt(durationSecs || 0n),
      Number(blankIndex || 0),
      { value: feeBaseWei }
    )
    return await tx.wait()
  }, [provider, switchToBase, getContracts, bootstrap])

  const joinPool1 = useCallback(async ({ id, word, username, blankIndex, feeBaseWei }) => {
    if (!provider) await bootstrap(true)
    const ok = await switchToBase()
    if (!ok) throw new Error('Please switch to Base.')

    const { fillin } = await getContracts(true)
    const poolId = BigInt(id)
    await fillin.joinPool1.staticCall(poolId, String(word||''), String(username||''), Number(blankIndex||0), { value: feeBaseWei })
    const tx = await fillin.joinPool1(poolId, String(word||''), String(username||''), Number(blankIndex||0), { value: feeBaseWei })
    return await tx.wait()
  }, [provider, switchToBase, getContracts, bootstrap])

  const claimPool1 = useCallback(async (id) => {
    if (!provider) await bootstrap(true)
    const ok = await switchToBase()
    if (!ok) throw new Error('Please switch to Base.')

    const { fillin } = await getContracts(true)
    await fillin.claimPool1.staticCall(BigInt(id))
    const tx = await fillin.claimPool1(BigInt(id))
    return await tx.wait()
  }, [provider, switchToBase, getContracts, bootstrap])

  const mintTemplateNFT = useCallback(async (...params) => {
    if (!provider) await bootstrap(true)
    const ok = await switchToBase()
    if (!ok) throw new Error('Please switch to Base.')
    const { nft } = await getContracts(true)
    const tx = await nft.mint(...params)
    return await tx.wait()
  }, [provider, switchToBase, getContracts, bootstrap])

  const value = useMemo(() => ({
    // connection
    address, isConnected: !!address, isOnBase, connect, switchToBase, provider, error,
    // contracts
    getContracts,
    // tx helpers
    createPool1, joinPool1, claimPool1, mintTemplateNFT,
    // constants (optional)
    BASE_RPC, FILLIN_ADDRESS, NFT_ADDRESS,
  }), [address, isOnBase, connect, switchToBase, provider, error, getContracts, createPool1, joinPool1, claimPool1, mintTemplateNFT])

  return <TxContext.Provider value={value}>{children}</TxContext.Provider>
}

export function useTx() {
  return useContext(TxContext)
}
