// components/TxProvider.jsx
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

/** ---------- Helper: gasLimit buffer (for wallet-driven paths) ---------- */
/** Keep small & conservative; wallet will still estimate/adjust internally. */
function buildBufferedOverrides({ from, value, gasLimitBase = 250_000, gasJitter = 50_000 }) {
  const overrides = {}
  if (from) overrides.from = from
  if (value !== undefined && value !== null) overrides.value = ethers.toBigInt(value)

  // Add a small deterministic buffer + jitter to avoid edge underestimates
  const buffer = BigInt(Math.max(0, gasLimitBase + Math.floor(Math.random() * Math.max(1, gasJitter)))))
  overrides.gasLimit = buffer
  // IMPORTANT: Do NOT set gasPrice / maxFeePerGas here; let the wallet do it.
  return overrides
}

export function TxProvider({ children }) {
  const { provider, signer, isOnBase, connect, switchToBase, address } = useWallet()

  // tx lifecycle state (for global confirmation UI)
  const [txStatus, setTxStatus] = useState(null)      // "pending" | "success" | "error" | null
  const [pendingTx, setPendingTx] = useState(null)    // tx hash while pending
  const [lastTx, setLastTx] = useState(null)          // last confirmed receipt (or null)

  // read-only provider for preflights, estimates & fee data
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

  /** Ensure wallet + Base before any write */
  const ensureReady = useCallback(async () => {
    if (!address) await connect()
    if (!isOnBase) {
      const ok = await switchToBase()
      if (!ok) throw new Error('Please switch to Base.')
    }
  }, [address, isOnBase, connect, switchToBase])

  /**
   * Preflight + fees on the public read RPC.
   * We KEEP using this for Pool 1 so feeBaseWei semantics remain unchanged.
   */
  const estimateWithRead = useCallback(
    async (contractAddress, abi, fnName, args, { from, value } = {}) => {
      const ctRead = new ethers.Contract(contractAddress, abi, read)

      // 1) Preflight revert with msg.sender/value context
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

      // 2) Gas estimate (best-effort + buffer)
      let gasLimit
      try {
        const est = await ctRead[fnName].estimateGas(...args, { from, value })
        gasLimit = (est * 12n) / 10n + 50_000n
      } catch {
        // proceed without explicit gasLimit (wallet will handle)
      }

      // 3) Fee data (EIP-1559 if available)
      const overrides = { value }
      if (from) overrides.from = from
      if (gasLimit) overrides.gasLimit = gasLimit

      try {
        const fd = await read.getFeeData()
        if (fd?.maxFeePerGas) overrides.maxFeePerGas = fd.maxFeePerGas
        if (fd?.maxPriorityFeePerGas) overrides.maxPriorityFeePerGas = fd.maxPriorityFeePerGas
        if (!fd?.maxFeePerGas && fd?.gasPrice) overrides.gasPrice = fd.gasPrice
      } catch {
        // ignore
      }

      return overrides
    },
    [read]
  )

  /** Standardize tx lifecycle for global UI */
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

  /** ---------------- Pool 1: create (UNCHANGED strategy) ---------------- */
  const createPool1 = useCallback(async ({
    title, theme, parts, word, username, feeBaseWei, durationSecs, blankIndex,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)

    // Coerce types to avoid "could not coalesce" issues
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

  /** ---------------- Pool 1: join (UNCHANGED strategy) ---------------- */
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

  /** ---------------- Pool 1: claim (UNCHANGED strategy) ---------------- */
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
   * ---------------- NFT: mint template (WALLET-DRIVEN strategy) ----------------
   * We REMOVE preflight + explicit fee fields to avoid rate-limit/revert flakiness.
   * - You pass only { value } and a small gasLimit buffer.
   * - Wallet (MetaMask/Coinbase) computes the exact fees at confirmation time.
   */
  const mintTemplateNFT = useCallback(async (title, description, theme, parts, { value } = {}) => {
    await ensureReady()
    const { nft } = getContracts(true)

    const args = [
      String(title ?? ''),
      String(description ?? ''),
      String(theme ?? ''),
      Array.isArray(parts) ? parts.map((p) => String(p ?? '')) : [],
    ]

    const overrides = buildBufferedOverrides({
      from: address,
      value: BigInt(value ?? 0n),
      gasLimitBase: 250_000,   // tweak if needed
      gasJitter: 50_000        // small randomness helps avoid edge cases
    })

    return await runTx(() => nft.mintTemplate(...args, overrides))
  }, [ensureReady, getContracts, address])

  /** ---------------- Context Value ---------------- */
  const valueCtx = useMemo(() => ({
    // connection
    address,
    isConnected: !!address,
    isOnBase,
    connect,
    switchToBase,
    provider,

    // contracts (optional reads)
    getContracts,

    // tx helpers
    createPool1,
    joinPool1,
    claimPool1,
    mintTemplateNFT,

    // tx state for UI confirmations
    txStatus,
    pendingTx,
    lastTx,

    // constants
    BASE_RPC,
    FILLIN_ADDRESS,
    NFT_ADDRESS,
    BASE_CHAIN_ID,
  }), [
    address, isOnBase, connect, switchToBase, provider,
    getContracts, createPool1, joinPool1, claimPool1, mintTemplateNFT,
    txStatus, pendingTx, lastTx
  ])

  return <TxContext.Provider value={valueCtx}>{children}</TxContext.Provider>
}

export const useTx = () => useContext(TxContext)
