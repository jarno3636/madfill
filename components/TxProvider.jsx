'use client'

import { createContext, useContext, useMemo, useCallback, useState } from 'react'
import { ethers } from 'ethers'
import { useWallet } from './WalletProvider'
import fillinAbi from '@/abi/FillInStoryV3_ABI.json'
import nftAbi from '@/abi/MadFillTemplateNFT_ABI.json'

/** ---------- Chain & RPC ---------- */
const BASE_CHAIN_ID = 8453n
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

/** ---------- Contracts ---------- */
const FILLIN_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F429442'

/** ---------- Context ---------- */
const TxContext = createContext(null)

/** ---------- Helper: gasLimit buffer (wallet computes fees) ---------- */
function buildBufferedOverrides({ from, value, gasLimitBase = 250_000, gasJitter = 50_000 }) {
  const overrides = {}
  if (from) overrides.from = from
  if (value !== undefined && value !== null) overrides.value = ethers.toBigInt(value)
  overrides.gasLimit = BigInt(gasLimitBase) + BigInt(Math.floor(Math.random() * Math.max(1, gasJitter)))
  return overrides
}

export function TxProvider({ children }) {
  const {
    provider, signer, isOnBase, connect, switchToBase, address,
    isWarpcast,
  } = useWallet()

  const [txStatus, setTxStatus] = useState(null)
  const [pendingTx, setPendingTx] = useState(null)
  const [lastTx, setLastTx] = useState(null)

  const read = useMemo(() => new ethers.JsonRpcProvider(BASE_RPC), [])

  const getContracts = useCallback(
    (needsSigner = true) => {
      const canWrite = Boolean(needsSigner && signer && provider)
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

    if (isWarpcast) {
      try {
        const net = await (signer ?? provider)?.getNetwork?.()
        if (net?.chainId && net.chainId !== BASE_CHAIN_ID) {
          console.warn('Warpcast provider reported non-Base chainId:', net.chainId)
        }
      } catch {}
      return
    }

    if (!isOnBase) {
      const ok = await switchToBase()
      if (!ok) throw new Error('Please switch to Base.')
    }
  }, [address, isOnBase, isWarpcast, connect, switchToBase, signer, provider])

  const estimateWithRead = useCallback(
    async (contractAddress, abi, fnName, args, { from, value } = {}) => {
      const ctRead = new ethers.Contract(contractAddress, abi, read)
      try {
        await ctRead[fnName].staticCall(...args, { from, value })
      } catch (e) {
        const msg =
          e?.info?.error?.message ||
          e?.shortMessage ||
          e?.reason ||
          e?.message ||
          'Transaction would revert'
        throw new Error(msg)
      }

      const overrides = {}
      if (value !== undefined && value !== null) overrides.value = ethers.toBigInt(value)
      if (from) overrides.from = from

      try {
        const est = await ctRead[fnName].estimateGas(...args, { from, value })
        overrides.gasLimit = (est * 12n) / 10n + 50_000n
      } catch {}
      return overrides
    },
    [read]
  )

  async function runTx(sendFn) {
    try {
      setTxStatus('pending')
      setPendingTx(null)
      setLastTx(null)

      const tx = await sendFn()
      setPendingTx(tx.hash)

      const receipt = await tx.wait()
      setTxStatus('success')
      setLastTx(receipt)
      setPendingTx(null)
      return receipt
    } catch (err) {
      console.error('TX error:', err)
      setTxStatus('error')
      setPendingTx(null)
      throw err
    }
  }

  /** ---------------- Pool 1: create ---------------- */
  const createPool1 = useCallback(async ({
    title, theme, parts, word, username, feeBaseWei, durationSecs, blankIndex,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)

    const fee = BigInt(feeBaseWei ?? 0n)
    const args = [
      String(title ?? ''),
      String(theme ?? ''),
      Array.isArray(parts) ? parts.map((p) => String(p ?? '')) : [],
      String(word ?? ''),
      String(username ?? ''),
      BigInt(feeBaseWei ?? 0n),
      BigInt(durationSecs ?? 0n),
      Number(blankIndex ?? 0) | 0,
    ]

    const overrides = await estimateWithRead(
      FILLIN_ADDRESS,
      fillinAbi,
      'createPool1',
      args,
      { from: address, value: fee }
    )

    return await runTx(() => fillin.createPool1(...args, overrides))
  }, [ensureReady, getContracts, estimateWithRead, address])

  /** ---------------- Pool 1: join ---------------- */
  const joinPool1 = useCallback(async ({ id, word, username, blankIndex, feeBaseWei }) => {
    await ensureReady()
    const { fillin } = getContracts(true)

    const poolId = BigInt(id ?? 0)
    const value  = BigInt(feeBaseWei ?? 0n)
    const args = [
      poolId,
      String(word ?? ''),
      String(username ?? ''),
      Number(blankIndex ?? 0) | 0,
    ]

    const overrides = await estimateWithRead(
      FILLIN_ADDRESS,
      fillinAbi,
      'joinPool1',
      args,
      { from: address, value }
    )

    return await runTx(() => fillin.joinPool1(...args, overrides))
  }, [ensureReady, getContracts, estimateWithRead, address])

  /** ---------------- Pool 1: claim ---------------- */
  const claimPool1 = useCallback(async (id) => {
    await ensureReady()
    const { fillin } = getContracts(true)

    const args = [BigInt(id ?? 0)]

    const overrides = await estimateWithRead(
      FILLIN_ADDRESS,
      fillinAbi,
      'claimPool1',
      args,
      { from: address }
    )

    return await runTx(() => fillin.claimPool1(...args, overrides))
  }, [ensureReady, getContracts, estimateWithRead, address])

  /**
   * ---------------- NFT: mint template ----------------
   * Normalizes placeholder "[BLANK]" to contract BLANK() before sending.
   */
  const mintTemplateNFT = useCallback(async (title, description, theme, parts, { value } = {}) => {
    await ensureReady()
    const { nft }     = getContracts(true)
    const { nft: nr } = getContracts(false) // read-only

    let onchainBlank = '[BLANK]'
    try {
      const b = await nr.BLANK()
      if (typeof b === 'string' && b.length) onchainBlank = b
    } catch {}

    const normalizedParts = Array.isArray(parts)
      ? parts.map((p) => (p === '[BLANK]' ? onchainBlank : String(p ?? '')))
      : []

    if (!normalizedParts.some((p) => p === onchainBlank)) {
      throw new Error('At least one BLANK must remain unfilled.')
    }

    const args = [
      String(title ?? ''),
      String(description ?? ''),
      String(theme ?? ''),
      normalizedParts,
    ]

    const preflight = await estimateWithRead(
      NFT_ADDRESS,
      nftAbi,
      'mintTemplate',
      args,
      { from: address, value: BigInt(value ?? 0n) }
    )

    const overrides = buildBufferedOverrides({
      from: address,
      value: preflight?.value ?? BigInt(value ?? 0n),
      gasLimitBase: Number(preflight?.gasLimit ?? 250_000n),
      gasJitter: 50_000,
    })

    return await runTx(() => nft.mintTemplate(...args, overrides))
  }, [ensureReady, getContracts, estimateWithRead, address])

  /** ---------------- Context Value ---------------- */
  const value = useMemo(() => ({
    address,
    isConnected: !!address,
    isOnBase,
    isWarpcast,
    connect,
    switchToBase,
    provider,

    getContracts,

    createPool1,
    joinPool1,
    claimPool1,
    mintTemplateNFT,

    txStatus,
    pendingTx,
    lastTx,

    BASE_RPC,
    FILLIN_ADDRESS,
    NFT_ADDRESS,
    BASE_CHAIN_ID,
  }), [
    address, isOnBase, isWarpcast, connect, switchToBase, provider,
    getContracts, createPool1, joinPool1, claimPool1, mintTemplateNFT,
    txStatus, pendingTx, lastTx
  ])

  return <TxContext.Provider value={value}>{children}</TxContext.Provider>
}

export const useTx = () => useContext(TxContext)
