// components/TxProvider.jsx
'use client'

import { createContext, useContext, useMemo, useCallback } from 'react'
import { ethers } from 'ethers'
import { useWallet } from './WalletProvider'
import fillinAbi from '@/abi/FillInStoryV3_ABI.json'
import nftAbi from '@/abi/MadFillTemplateNFT_ABI.json'

const BASE_CHAIN_ID = 8453n
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

const FILLIN_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F429442'

const TxContext = createContext(null)

export function TxProvider({ children }) {
  const {
    provider, signer, isOnBase, connect, switchToBase, address,
  } = useWallet()

  // Always have a read provider for public reads & staticCall fallbacks
  const read = useMemo(() => new ethers.JsonRpcProvider(BASE_RPC), [])

  const getContracts = useCallback(
    (needsSigner = true) => {
      const canWrite = needsSigner && signer && provider
      const runner = canWrite ? signer : read
      return {
        fillin: new ethers.Contract(FILLIN_ADDRESS, fillinAbi, runner),
        nft:    new ethers.Contract(NFT_ADDRESS,    nftAbi,    runner),
      }
    },
    [provider, signer, read]
  )

  const ensureReady = useCallback(async () => {
    if (!address) await connect()
    if (!isOnBase) {
      const ok = await switchToBase()
      if (!ok) throw new Error('Please switch to Base.')
    }
  }, [address, isOnBase, connect, switchToBase])

  const createPool1 = useCallback(async ({
    title, theme, parts, word, username, feeBaseWei, durationSecs, blankIndex,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)

    // Preflight for human-readable revert
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
  }, [ensureReady, getContracts])

  const joinPool1 = useCallback(async ({ id, word, username, blankIndex, feeBaseWei }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const poolId = BigInt(id)

    await fillin.joinPool1.staticCall(poolId, String(word||''), String(username||''), Number(blankIndex||0), { value: feeBaseWei })
    const tx = await fillin.joinPool1(poolId, String(word||''), String(username||''), Number(blankIndex||0), { value: feeBaseWei })
    return await tx.wait()
  }, [ensureReady, getContracts])

  const claimPool1 = useCallback(async (id) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    await fillin.claimPool1.staticCall(BigInt(id))
    const tx = await fillin.claimPool1(BigInt(id))
    return await tx.wait()
  }, [ensureReady, getContracts])

  const mintTemplateNFT = useCallback(async (title, description, theme, parts, valueWei) => {
    await ensureReady()
    const { nft } = getContracts(true)
    const tx = await nft.mintTemplate(
      String(title || ''),
      String(description || ''),
      String(theme || ''),
      Array.isArray(parts) ? parts.map(String) : [],
      { value: BigInt(valueWei || 0n) }
    )
    return await tx.wait()
  }, [ensureReady, getContracts])

  const value = useMemo(() => ({
    // connection (from WalletProvider)
    address, isConnected: !!address, isOnBase, connect, switchToBase, provider,
    // contracts read helper (optional for pages)
    getContracts,
    // tx helpers
    createPool1, joinPool1, claimPool1, mintTemplateNFT,
    // constants
    BASE_RPC, FILLIN_ADDRESS, NFT_ADDRESS,
  }), [address, isOnBase, connect, switchToBase, provider, getContracts, createPool1, joinPool1, claimPool1, mintTemplateNFT])

  return <TxContext.Provider value={value}>{children}</TxContext.Provider>
}

export const useTx = () => useContext(TxContext)
