// components/TxProvider.jsx
'use client'

import { createContext, useContext, useMemo, useCallback } from 'react'
import { ethers } from 'ethers'
import { useWallet } from './WalletProvider'
import fillinAbi from '@/abi/FillInStoryV3_ABI.json'
import nftAbi from '@/abi/MadFillTemplateNFT_ABI.json'

/** -------- Chain / RPC -------- */
const BASE_CHAIN_ID = 8453n
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

/** -------- Contracts -------- */
const FILLIN_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F429442'

/** -------- Context -------- */
const TxContext = createContext(null)

/** -------- Helpers -------- */
const toBigInt = (v, def = 0n) => {
  try {
    if (typeof v === 'bigint') return v
    if (typeof v === 'number') return BigInt(Math.floor(v))
    if (typeof v === 'string') {
      // handle hex or decimal
      return v.trim().startsWith('0x') ? BigInt(v) : BigInt(v.trim())
    }
    if (v && typeof v.toString === 'function') return BigInt(v.toString())
  } catch {}
  return def
}

const toUInt8 = (v, def = 0) => {
  const n = Number(v ?? def)
  return Number.isFinite(n) ? Math.max(0, Math.min(255, Math.floor(n))) : def
}

const errMsg = (e, fb = 'Transaction failed') =>
  e?.info?.error?.message ||
  e?.shortMessage ||
  e?.reason ||
  e?.data?.message ||
  e?.message ||
  fb

export function TxProvider({ children }) {
  const {
    provider, signer, isOnBase, connect, switchToBase, address,
  } = useWallet()

  // Always-on read provider (for public reads + preflight)
  const read = useMemo(() => new ethers.JsonRpcProvider(BASE_RPC), [])

  /** Contracts bound to a runner (signer for write, read provider for read) */
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

  /** Read-only contracts (force RPC runner) */
  const getReadOnlyContracts = useCallback(() => {
    return {
      fillin: new ethers.Contract(FILLIN_ADDRESS, fillinAbi, read),
      nft:    new ethers.Contract(NFT_ADDRESS,    nftAbi,    read),
    }
  }, [read])

  /** Ensure wallet is connected + on Base */
  const ensureReady = useCallback(async () => {
    if (!address) await connect()
    if (!isOnBase) {
      const ok = await switchToBase()
      if (!ok) throw new Error('Please switch to Base.')
    }
  }, [address, isOnBase, connect, switchToBase])

  /* ===========================================================
   * Pool 1
   * ===========================================================
   */

  const createPool1 = useCallback(async ({
    title, theme, parts, word, username, feeBaseWei, durationSecs, blankIndex,
  }) => {
    await ensureReady()

    const fee = toBigInt(feeBaseWei, 0n)
    const duration = toBigInt(durationSecs, 0n)
    const idx = toUInt8(blankIndex, 0)

    // 1) Preflight ALWAYS via read RPC to avoid EIP-1193 quirks
    try {
      const { fillin: fillRead } = getReadOnlyContracts()
      await fillRead.createPool1.staticCall(
        String(title || ''),
        String(theme || ''),
        Array.isArray(parts) ? parts.map(String) : [],
        String(word || ''),
        String(username || ''),
        fee,
        duration,
        idx,
        { value: fee, from: address || undefined }
      )
    } catch (e) {
      // If preflight reverts, surface the reason early
      throw new Error(errMsg(e, 'Preflight failed (createPool1)'))
    }

    // 2) Send real tx with signer
    try {
      const { fillin } = getContracts(true)
      const tx = await fillin.createPool1(
        String(title || ''),
        String(theme || ''),
        Array.isArray(parts) ? parts.map(String) : [],
        String(word || ''),
        String(username || ''),
        fee,
        duration,
        idx,
        { value: fee }
      )
      return await tx.wait()
    } catch (e) {
      throw new Error(errMsg(e, 'Create failed'))
    }
  }, [ensureReady, getContracts, getReadOnlyContracts, address])

  const joinPool1 = useCallback(async ({ id, word, username, blankIndex, feeBaseWei }) => {
    await ensureReady()

    const poolId = toBigInt(id)
    const fee = toBigInt(feeBaseWei, 0n)
    const idx = toUInt8(blankIndex, 0)

    // Preflight via read RPC
    try {
      const { fillin: fillRead } = getReadOnlyContracts()
      await fillRead.joinPool1.staticCall(
        poolId, String(word||''), String(username||''), idx,
        { value: fee, from: address || undefined }
      )
    } catch (e) {
      throw new Error(errMsg(e, 'Preflight failed (joinPool1)'))
    }

    // Send tx
    try {
      const { fillin } = getContracts(true)
      const tx = await fillin.joinPool1(
        poolId, String(word||''), String(username||''), idx, { value: fee }
      )
      return await tx.wait()
    } catch (e) {
      throw new Error(errMsg(e, 'Join failed'))
    }
  }, [ensureReady, getContracts, getReadOnlyContracts, address])

  const claimPool1 = useCallback(async (id) => {
    await ensureReady()
    const poolId = toBigInt(id)

    // Preflight (read)
    try {
      const { fillin: fillRead } = getReadOnlyContracts()
      await fillRead.claimPool1.staticCall(poolId, { from: address || undefined })
    } catch (e) {
      throw new Error(errMsg(e, 'Preflight failed (claimPool1)'))
    }

    // Send tx
    try {
      const { fillin } = getContracts(true)
      const tx = await fillin.claimPool1(poolId)
      return await tx.wait()
    } catch (e) {
      throw new Error(errMsg(e, 'Claim failed'))
    }
  }, [ensureReady, getContracts, getReadOnlyContracts, address])

  /* ===========================================================
   * Pool 2 (optional helpers for Challenge/Vote pages)
   * ===========================================================
   */

  const createPool2 = useCallback(async ({
    pool1Id, challengerWord, challengerUsername, feeBaseWei, durationSecs,
  }) => {
    await ensureReady()

    const p1 = toBigInt(pool1Id)
    const fee = toBigInt(feeBaseWei, 0n)
    const duration = toBigInt(durationSecs, 0n)

    try {
      const { fillin: fillRead } = getReadOnlyContracts()
      await fillRead.createPool2.staticCall(
        p1,
        String(challengerWord || ''),
        String(challengerUsername || ''),
        fee,
        duration,
        { value: fee, from: address || undefined }
      )
    } catch (e) {
      throw new Error(errMsg(e, 'Preflight failed (createPool2)'))
    }

    try {
      const { fillin } = getContracts(true)
      const tx = await fillin.createPool2(
        p1,
        String(challengerWord || ''),
        String(challengerUsername || ''),
        fee,
        duration,
        { value: fee }
      )
      return await tx.wait()
    } catch (e) {
      throw new Error(errMsg(e, 'Challenge failed'))
    }
  }, [ensureReady, getContracts, getReadOnlyContracts, address])

  const votePool2 = useCallback(async ({ id, voteChallenger, valueWei }) => {
    await ensureReady()

    const p2 = toBigInt(id)
    const v = Boolean(voteChallenger)
    const value = toBigInt(valueWei, 0n)

    try {
      const { fillin: fillRead } = getReadOnlyContracts()
      await fillRead.votePool2.staticCall(p2, v, { value, from: address || undefined })
    } catch (e) {
      throw new Error(errMsg(e, 'Preflight failed (votePool2)'))
    }

    try {
      const { fillin } = getContracts(true)
      const tx = await fillin.votePool2(p2, v, { value })
      return await tx.wait()
    } catch (e) {
      throw new Error(errMsg(e, 'Vote failed'))
    }
  }, [ensureReady, getContracts, getReadOnlyContracts, address])

  const claimPool2 = useCallback(async (id) => {
    await ensureReady()
    const p2 = toBigInt(id)

    try {
      const { fillin: fillRead } = getReadOnlyContracts()
      await fillRead.claimPool2.staticCall(p2, { from: address || undefined })
    } catch (e) {
      throw new Error(errMsg(e, 'Preflight failed (claimPool2)'))
    }

    try {
      const { fillin } = getContracts(true)
      const tx = await fillin.claimPool2(p2)
      return await tx.wait()
    } catch (e) {
      throw new Error(errMsg(e, 'Claim failed'))
    }
  }, [ensureReady, getContracts, getReadOnlyContracts, address])

  /* ===========================================================
   * NFT
   * ===========================================================
   */

  const mintTemplateNFT = useCallback(async (title, description, theme, parts, { value } = {}) => {
    await ensureReady()
    const valueWei = toBigInt(value, 0n)

    // No preflight here (usually fine), but we can do a read-call for safety:
    try {
      const { nft: nftRead } = getReadOnlyContracts()
      await nftRead.mintTemplate.staticCall(
        String(title || ''),
        String(description || ''),
        String(theme || ''),
        Array.isArray(parts) ? parts.map(String) : [],
        { value: valueWei, from: address || undefined }
      )
    } catch (e) {
      throw new Error(errMsg(e, 'Preflight failed (mintTemplate)'))
    }

    try {
      const { nft } = getContracts(true)
      const tx = await nft.mintTemplate(
        String(title || ''),
        String(description || ''),
        String(theme || ''),
        Array.isArray(parts) ? parts.map(String) : [],
        { value: valueWei }
      )
      return await tx.wait()
    } catch (e) {
      throw new Error(errMsg(e, 'Mint failed'))
    }
  }, [ensureReady, getContracts, getReadOnlyContracts, address])

  /** -------- Value exposed to app -------- */
  const value = useMemo(() => ({
    // connection (from WalletProvider)
    address, isConnected: !!address, isOnBase, connect, switchToBase, provider,

    // contracts read helper (optional)
    getContracts,

    // tx helpers (Pool1 / Pool2 / NFT)
    createPool1, joinPool1, claimPool1,
    createPool2, votePool2, claimPool2,
    mintTemplateNFT,

    // constants
    BASE_RPC, FILLIN_ADDRESS, NFT_ADDRESS, BASE_CHAIN_ID,
  }), [
    address, isOnBase, connect, switchToBase, provider,
    getContracts,
    createPool1, joinPool1, claimPool1,
    createPool2, votePool2, claimPool2,
    mintTemplateNFT,
  ])

  return <TxContext.Provider value={value}>{children}</TxContext.Provider>
}

export const useTx = () => useContext(TxContext)
