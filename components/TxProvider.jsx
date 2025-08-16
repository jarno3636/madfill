// components/TxProvider.jsx
'use client'

import { createContext, useContext, useMemo, useCallback } from 'react'
import { ethers } from 'ethers'
import { useWallet } from './WalletProvider'
import fillinAbi from '@/abi/FillInStoryV3_ABI.json'
import nftAbi from '@/abi/MadFillTemplateNFT_ABI.json'

/** ---------- Chain / RPC ---------- */
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

/** ---------- Contract addresses ---------- */
const FILLIN_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F429442'

/** ---------- Context ---------- */
const TxContext = createContext(null)

/**
 * TxProvider
 * Uses WalletProvider for connection state; exposes read + tx helpers.
 * All write funcs do:
 *   - ensure connected
 *   - ensure Base
 *   - staticCall first for friendly reverts
 */
export function TxProvider({ children }) {
  const {
    provider, signer, isOnBase, connect, switchToBase, address,
  } = useWallet()

  // Public read provider (never signs)
  const read = useMemo(() => new ethers.JsonRpcProvider(BASE_RPC), [])

  /** Build contracts with signer if available (or read-only). */
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

  /** Ensure connected & on Base before any write. */
  const ensureReady = useCallback(async () => {
    if (!address) await connect()
    if (!isOnBase) {
      const ok = await switchToBase()
      if (!ok) throw new Error('Please switch to Base.')
    }
  }, [address, isOnBase, connect, switchToBase])

  // --------------------------- READ HELPERS ---------------------------

  /** Pool 1: protocol fees */
  const getFeeInfo = useCallback(async () => {
    const { fillin } = getContracts(false)
    const [feeBps, den] = await Promise.all([
      fillin.FEE_BPS().catch(() => null),
      fillin.BPS_DENOMINATOR().catch(() => 10000n),
    ])
    return { feeBps, denominator: den }
  }, [getContracts])

  /** Pool 1: info for a round */
  const getPool1Info = useCallback(async (id) => {
    const { fillin } = getContracts(false)
    return await fillin.getPool1Info(BigInt(id))
  }, [getContracts])

  /** Pool 1: taken blanks (bool[]), or packed submissions if needed */
  const getPool1Taken = useCallback(async (id) => {
    const { fillin } = getContracts(false)
    return await fillin.getPool1Taken(BigInt(id))
  }, [getContracts])

  const getPool1SubmissionsPacked = useCallback(async (id) => {
    const { fillin } = getContracts(false)
    // returns { addrs, usernames, words, blankIndexes }
    return await fillin.getPool1SubmissionsPacked(BigInt(id))
  }, [getContracts])

  /** Pool 2: info / tallies */
  const getPool2Info = useCallback(async (id) => {
    const { fillin } = getContracts(false)
    return await fillin.getPool2Info(BigInt(id))
  }, [getContracts])

  const getPool2InfoFull = useCallback(async (id) => {
    const { fillin } = getContracts(false)
    return await fillin.getPool2InfoFull(BigInt(id))
  }, [getContracts])

  const getPool2Tallies = useCallback(async (id) => {
    const { fillin } = getContracts(false)
    return await fillin.getPool2Tallies(BigInt(id))
  }, [getContracts])

  // --------------------------- WRITE HELPERS ---------------------------

  // ---- Pool 1 ----
  const createPool1 = useCallback(async ({
    title, theme, parts, word, username, feeBaseWei, durationSecs, blankIndex,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)

    // Preflight for revert reason
    await fillin.createPool1.staticCall(
      String(title || ''),
      String(theme || ''),
      Array.isArray(parts) ? parts.map(String) : [],
      String(word || ''),
      String(username || ''),
      BigInt(feeBaseWei || 0n),
      BigInt(durationSecs || 0n),
      Number(blankIndex || 0),
      { value: BigInt(feeBaseWei || 0n) }
    )

    const tx = await fillin.createPool1(
      String(title || ''),
      String(theme || ''),
      Array.isArray(parts) ? parts.map(String) : [],
      String(word || ''),
      String(username || ''),
      BigInt(feeBaseWei || 0n),
      BigInt(durationSecs || 0n),
      Number(blankIndex || 0),
      { value: BigInt(feeBaseWei || 0n) }
    )
    return await tx.wait()
  }, [ensureReady, getContracts])

  const joinPool1 = useCallback(async ({ id, word, username, blankIndex, feeBaseWei }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const poolId = BigInt(id)

    await fillin.joinPool1.staticCall(
      poolId,
      String(word || ''),
      String(username || ''),
      Number(blankIndex || 0),
      { value: BigInt(feeBaseWei || 0n) }
    )

    const tx = await fillin.joinPool1(
      poolId,
      String(word || ''),
      String(username || ''),
      Number(blankIndex || 0),
      { value: BigInt(feeBaseWei || 0n) }
    )
    return await tx.wait()
  }, [ensureReady, getContracts])

  const claimPool1 = useCallback(async (id) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const poolId = BigInt(id)
    await fillin.claimPool1.staticCall(poolId)
    const tx = await fillin.claimPool1(poolId)
    return await tx.wait()
  }, [ensureReady, getContracts])

  // ---- Pool 2 ----
  const createPool2 = useCallback(async ({
    pool1Id, word, username, feeBaseWei, durationSecs,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const id = BigInt(pool1Id)

    await fillin.createPool2.staticCall(
      id,
      String(word || ''),
      String(username || ''),
      BigInt(feeBaseWei || 0n),
      BigInt(durationSecs || 0n),
      { value: BigInt(feeBaseWei || 0n) }
    )

    const tx = await fillin.createPool2(
      id,
      String(word || ''),
      String(username || ''),
      BigInt(feeBaseWei || 0n),
      BigInt(durationSecs || 0n),
      { value: BigInt(feeBaseWei || 0n) }
    )
    return await tx.wait()
  }, [ensureReady, getContracts])

  const votePool2 = useCallback(async ({ id, voteChallenger, valueWei }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const poolId = BigInt(id)

    await fillin.votePool2.staticCall(poolId, !!voteChallenger, {
      value: BigInt(valueWei || 0n)
    })
    const tx = await fillin.votePool2(poolId, !!voteChallenger, {
      value: BigInt(valueWei || 0n)
    })
    return await tx.wait()
  }, [ensureReady, getContracts])

  const claimPool2 = useCallback(async (id) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const poolId = BigInt(id)
    await fillin.claimPool2.staticCall(poolId)
    const tx = await fillin.claimPool2(poolId)
    return await tx.wait()
  }, [ensureReady, getContracts])

  // ---- NFT Template ----
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

  /** Context value */
  const value = useMemo(() => ({
    // connection (from WalletProvider)
    address, isConnected: !!address, isOnBase, connect, switchToBase, provider,

    // read helpers
    getContracts,
    getFeeInfo,
    getPool1Info,
    getPool1Taken,
    getPool1SubmissionsPacked,
    getPool2Info,
    getPool2InfoFull,
    getPool2Tallies,

    // Pool1
    createPool1, joinPool1, claimPool1,

    // Pool2
    createPool2, votePool2, claimPool2,

    // NFT
    mintTemplateNFT,

    // constants
    BASE_RPC, FILLIN_ADDRESS, NFT_ADDRESS,
  }), [
    address, isOnBase, connect, switchToBase, provider,
    getContracts, getFeeInfo, getPool1Info, getPool1Taken, getPool1SubmissionsPacked,
    getPool2Info, getPool2InfoFull, getPool2Tallies,
    createPool1, joinPool1, claimPool1,
    createPool2, votePool2, claimPool2,
    mintTemplateNFT
  ])

  return <TxContext.Provider value={value}>{children}</TxContext.Provider>
}

export const useTx = () => useContext(TxContext)
