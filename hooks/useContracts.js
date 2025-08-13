'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ethers } from 'ethers'
import { useMiniWallet } from './useMiniWallet'

/**
 * ENV + constants
 */
const ADDRS = {
  FILL_IN_STORY: process.env.NEXT_PUBLIC_FILLIN_ADDRESS || '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b',
  // ⬇️ you told me this exact address/name earlier — using it here
  MADFILL_TEMPLATE_NFT: process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS || '0x0F22124A86F8893990fA4763393E46d97F429442',
}
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '8453')

/**
 * ABIs (loaded once)
 * You can also import JSON directly; keeping dynamic import to avoid any SSR pitfalls.
 */
let V3_ABI, TEMPLATE_NFT_ABI
async function loadAbis() {
  if (V3_ABI && TEMPLATE_NFT_ABI) return
  const [v3, nft] = await Promise.all([
    import('../abi/FillInStoryV3_ABI.json'),
    import('../abi/MadFillTemplateNFT_ABI.json'),
  ])
  V3_ABI = v3.default || v3
  TEMPLATE_NFT_ABI = nft.default || nft
}

/**
 * Helpers
 */
const toBigInt = (x) => (typeof x === 'bigint' ? x : BigInt(x?.toString?.() ?? '0'))

const extractError = (e) =>
  e?.shortMessage || e?.reason || e?.error?.message || e?.data?.message || e?.message || 'Transaction failed'

/**
 * Hook
 */
export function useContracts() {
  const { address, isConnected } = useMiniWallet()
  const [provider, setProvider] = useState(null)          // read-only
  const [signer, setSigner] = useState(null)              // connected signer (if available)
  const [contracts, setContracts] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isReady, setIsReady] = useState(false)

  // init provider (always)
  useEffect(() => {
    const rp = new ethers.JsonRpcProvider(BASE_RPC)
    setProvider(rp)
  }, [])

  // load ABIs once
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadAbis()
        if (!cancelled) setIsReady(true)
      } catch (e) {
        console.error('ABI load failed:', e)
        if (!cancelled) setError(e)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // signer (if connected)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!(isConnected && address)) {
        setSigner(null)
        return
      }
      try {
        if (typeof window !== 'undefined' && window.ethereum) {
          const browserProvider = new ethers.BrowserProvider(window.ethereum)
          const net = await browserProvider.getNetwork()
          if (Number(net.chainId) !== CHAIN_ID) {
            try {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
              })
            } catch (switchErr) {
              console.warn('Network switch failed (continuing in read-only):', switchErr)
            }
          }
          const s = await browserProvider.getSigner()
          if (!cancelled) setSigner(s)
        } else {
          setSigner(null)
        }
      } catch (e) {
        console.warn('Failed to get signer, continuing read-only:', e)
        if (!cancelled) setSigner(null)
      }
    })()
    return () => { cancelled = true }
  }, [isConnected, address])

  // build contract instances (prefer signer else provider)
  useEffect(() => {
    if (!isReady || !provider) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    try {
      const runner = signer || provider
      const fillInStory = new ethers.Contract(ADDRS.FILL_IN_STORY, V3_ABI, runner)
      const templateNft = new ethers.Contract(ADDRS.MADFILL_TEMPLATE_NFT, TEMPLATE_NFT_ABI, runner)
      if (!cancelled) setContracts({ fillInStory, templateNft })
    } catch (e) {
      console.error('Contract init failed:', e)
      if (!cancelled) setError(e)
    } finally {
      setIsLoading(false)
    }
    return () => { cancelled = true }
  }, [isReady, provider, signer])

  /**
   * ---------- V3 Pool (feeBase consistency) ----------
   * NOTE: V3 getPool1Info returns (from your page code):
   * [name, theme, parts, feeBase, deadline, creator, participants, winner, claimed, poolBalance]
   */
  const getPool1Info = useCallback(async (poolId) => {
    if (!contracts?.fillInStory) throw new Error('Contracts not ready')
    try {
      const info = await contracts.fillInStory.getPool1Info(toBigInt(poolId))
      // Normalize by named keys used across the app
      return {
        name: info.name_ ?? info[0],
        theme: info.theme_ ?? info[1],
        parts: info.parts_ ?? info[2],
        feeBase: toBigInt(info.feeBase_ ?? info[3]),
        deadline: Number(info.deadline_ ?? info[4]),
        creator: info.creator_ ?? info[5],
        participants: info.participants_ ?? info[6],
        winner: info.winner_ ?? info[7],
        claimed: Boolean(info.claimed_ ?? info[8]),
        poolBalance: toBigInt(info.poolBalance_ ?? info[9]),
      }
    } catch (e) {
      throw new Error(extractError(e))
    }
  }, [contracts])

  const joinPool1 = useCallback(async (poolId, word, username, blankIndex, feeBaseWei) => {
    if (!contracts?.fillInStory || !signer) throw new Error('Wallet not connected or contracts not initialized')
    try {
      const id = toBigInt(poolId)
      const value = toBigInt(feeBaseWei) // feeBase is authoritative (chain-calculated)

      // Preflight for better errors
      await contracts.fillInStory.joinPool1.staticCall(
        id,
        String(word),
        String(username || '').slice(0, 32),
        Number(blankIndex),
        { value }
      )

      const tx = await contracts.fillInStory.joinPool1(
        id,
        String(word),
        String(username || '').slice(0, 32),
        Number(blankIndex),
        { value }
      )
      const receipt = await tx.wait()
      return { tx, receipt }
    } catch (e) {
      throw new Error(extractError(e))
    }
  }, [contracts, signer])

  // Optional: createPool1 (if the UI needs it); uses entryFee only as value
  const createPool1 = useCallback(async ({
    name, theme, parts, word, username, entryFeeWei, durationSeconds, blankIndex
  }) => {
    if (!contracts?.fillInStory || !signer) throw new Error('Wallet not connected or contracts not initialized')
    try {
      const value = toBigInt(entryFeeWei ?? 0n)
      const dur = toBigInt(durationSeconds ?? 0n)

      await contracts.fillInStory.createPool1.staticCall(
        String(name), String(theme), parts, String(word), String(username || '').slice(0,32),
        value, dur, Number(blankIndex), { value }
      )
      const tx = await contracts.fillInStory.createPool1(
        String(name), String(theme), parts, String(word), String(username || '').slice(0,32),
        value, dur, Number(blankIndex), { value }
      )
      const receipt = await tx.wait()
      return { tx, receipt }
    } catch (e) {
      throw new Error(extractError(e))
    }
  }, [contracts, signer])

  /**
   * ---------- Template NFT wiring ----------
   * From your ABI:
   * - getMintPriceWei() -> uint256
   * - mintTemplate(title, description, theme, parts[]) payable
   * - plus view helpers (BLANK, etc.)
   */
  const getTemplateMintPrice = useCallback(async () => {
    if (!contracts?.templateNft) throw new Error('Contracts not ready')
    try {
      const p = await contracts.templateNft.getMintPriceWei()
      return toBigInt(p)
    } catch (e) {
      throw new Error(extractError(e))
    }
  }, [contracts])

  const mintTemplate = useCallback(async ({ title, description, theme, parts }) => {
    if (!contracts?.templateNft || !signer) throw new Error('Wallet not connected or contracts not initialized')
    try {
      const price = await contracts.templateNft.getMintPriceWei()
      const value = toBigInt(price)

      // Preflight
      await contracts.templateNft.mintTemplate.staticCall(
        String(title), String(description || ''), String(theme || ''), parts, { value }
      )

      const tx = await contracts.templateNft.mintTemplate(
        String(title), String(description || ''), String(theme || ''), parts, { value }
      )
      const receipt = await tx.wait()
      return { tx, receipt }
    } catch (e) {
      throw new Error(extractError(e))
    }
  }, [contracts, signer])

  /**
   * getUserNFTs (no ERC721Enumerable in your ABI)
   * We’ll derive by scanning Transfer logs TO the user. You can optimize by
   * setting NEXT_PUBLIC_TEMPLATE_NFT_DEPLOY_BLOCK to narrow the scan range.
   */
  const getUserNFTs = useCallback(async (owner) => {
    const o = (owner || address)
    if (!o) return []
    if (!provider) return []
    const contract = new ethers.Contract(ADDRS.MADFILL_TEMPLATE_NFT, TEMPLATE_NFT_ABI, provider)

    const iface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
    ])
    const transferTopic = iface.getEvent('Transfer').topicHash
    const fromBlock = Number(process.env.NEXT_PUBLIC_TEMPLATE_NFT_DEPLOY_BLOCK || '0') || 0

    // All transfers to owner
    const logs = await provider.getLogs({
      address: ADDRS.MADFILL_TEMPLATE_NFT,
      fromBlock,
      toBlock: 'latest',
      topics: [transferTopic, null, ethers.zeroPadValue(o, 32)],
    })

    // reconstruct current balance set (include later transfers out)
    const owned = new Set()
    for (const log of logs) {
      const parsed = iface.parseLog(log)
      const { from, to, tokenId } = parsed.args
      const id = Number(tokenId)
      if (to.toLowerCase() === o.toLowerCase()) owned.add(id)
      if (from.toLowerCase() === o.toLowerCase()) owned.delete(id)
    }
    return Array.from(owned).sort((a,b)=>a-b)
  }, [address, provider])

  return {
    // status
    provider, signer, contracts, isLoading, error, isReady: Boolean(contracts),

    // V3 Pool
    getPool1Info,
    joinPool1,
    createPool1, // optional if needed by UI

    // Template NFT
    getTemplateMintPrice,
    mintTemplate,
    getUserNFTs,

    // addresses
    addresses: { ...ADDRS, chainId: CHAIN_ID },
  }
}
