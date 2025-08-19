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
// FillIn (unchanged; replace default if you want)
const FILLIN_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

// MadFill Template NFT — defaulted to the address you gave me
const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0xCA699Fb766E3FaF36AC31196fb4bd7184769DD20'

/** ---------- Context ---------- */
const TxContext = createContext(null)

/** ---------- Helper: gasLimit buffer ---------- */
function buildBufferedOverrides({ from, value, gasLimitBase = 250_000, gasJitter = 50_000 }) {
  const overrides = {}
  if (from) overrides.from = from
  if (value !== undefined && value !== null) overrides.value = ethers.toBigInt(value)
  overrides.gasLimit =
    BigInt(gasLimitBase) + BigInt(Math.floor(Math.random() * Math.max(1, gasJitter)))
  return overrides
}

export function TxProvider({ children }) {
  const { provider, signer, isOnBase, connect, switchToBase, address, isWarpcast } = useWallet()

  const [txStatus, setTxStatus] = useState(null)     // 'pending' | 'success' | 'error' | null
  const [pendingTx, setPendingTx] = useState(null)   // hash
  const [lastTx, setLastTx] = useState(null)         // receipt

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

  // Don’t force chain-switch inside Warpcast (it often breaks)
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

  /** ---------------- Pool 1 ---------------- */
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
      fee,
      BigInt(durationSecs ?? 0n),
      Number(blankIndex ?? 0) | 0,
    ]
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'createPool1', args, { from: address, value: fee }
    )
    return await runTx(() => fillin.createPool1(...args, overrides))
  }, [ensureReady, getContracts, estimateWithRead, address])

  const joinPool1 = useCallback(async ({ id, word, username, blankIndex, feeBaseWei }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const poolId = BigInt(id ?? 0)
    const value  = BigInt(feeBaseWei ?? 0n)
    const args = [poolId, String(word ?? ''), String(username ?? ''), Number(blankIndex ?? 0) | 0]
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'joinPool1', args, { from: address, value }
    )
    return await runTx(() => fillin.joinPool1(...args, overrides))
  }, [ensureReady, getContracts, estimateWithRead, address])

  const claimPool1 = useCallback(async (id) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const args = [BigInt(id ?? 0)]
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'claimPool1', args, { from: address }
    )
    return await runTx(() => fillin.claimPool1(...args, overrides))
  }, [ensureReady, getContracts, estimateWithRead, address])

  /** ---------------- Pool 2 ---------------- */
  const createPool2 = useCallback(async ({
    pool1Id, challengerWord, challengerUsername, feeBaseWei, durationSecs,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const value = BigInt(feeBaseWei ?? 0n) // msg.value == initial pot / vote fee base
    const args = [
      BigInt(pool1Id ?? 0),
      String(challengerWord ?? ''),
      String(challengerUsername ?? ''),
      value,
      BigInt(durationSecs ?? 0n),
    ]
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'createPool2', args, { from: address, value }
    )
    return await runTx(() => fillin.createPool2(...args, overrides))
  }, [ensureReady, getContracts, estimateWithRead, address])

  const votePool2 = useCallback(async ({ id, voteChallenger, feeWei }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const args = [BigInt(id ?? 0), Boolean(voteChallenger)]
    const value = BigInt(feeWei ?? 0n) // voting fee
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'votePool2', args, { from: address, value }
    )
    return await runTx(() => fillin.votePool2(...args, overrides))
  }, [ensureReady, getContracts, estimateWithRead, address])

  const claimPool2 = useCallback(async (id) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const args = [BigInt(id ?? 0)]
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'claimPool2', args, { from: address }
    )
    return await runTx(() => fillin.claimPool2(...args, overrides))
  }, [ensureReady, getContracts, estimateWithRead, address])

  /** ---------------- NFT ---------------- */
  const mintTemplateNFT = useCallback(async (title, description, theme, parts, { value } = {}) => {
    await ensureReady()
    const { nft } = getContracts(true)
    const args = [
      String(title ?? ''),
      String(description ?? ''),
      String(theme ?? ''),
      Array.isArray(parts) ? parts.map((p) => String(p ?? '')) : [],
    ]
    const preflight = await estimateWithRead(
      NFT_ADDRESS, nftAbi, 'mintTemplate', args, { from: address, value: BigInt(value ?? 0n) }
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

    // Pool 1
    createPool1, joinPool1, claimPool1,

    // Pool 2
    createPool2, votePool2, claimPool2,

    // NFT
    mintTemplateNFT,

    txStatus, pendingTx, lastTx,

    BASE_RPC, FILLIN_ADDRESS, NFT_ADDRESS, BASE_CHAIN_ID,
  }), [
    address, isOnBase, isWarpcast, connect, switchToBase, provider,
    getContracts,
    createPool1, joinPool1, claimPool1,
    createPool2, votePool2, claimPool2,
    mintTemplateNFT,
    txStatus, pendingTx, lastTx
  ])

  return <TxContext.Provider value={value}>{children}</TxContext.Provider>
}

export const useTx = () => useContext(TxContext)
