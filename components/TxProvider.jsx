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

  // Read-only provider used for all static calls & estimations (never the Mini provider)
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

  /**
   * Use the public read RPC to:
   *  - do the same call as the tx (staticCall) with from/value to catch reverts
   *  - estimate gas safely (Mini provider sometimes lacks eth_estimateGas/feeHistory)
   *  - get fee data and return overrides for the real send (with signer)
   */
  const estimateWithRead = useCallback(
    async (contractAddress, abi, fnName, args, { from, value } = {}) => {
      const ctRead = new ethers.Contract(contractAddress, abi, read)

      // 1) Preflight revert with proper msg.sender context
      try {
        await ctRead[fnName].staticCall(...args, { from, value })
      } catch (e) {
        // Re-throw with the most useful reason available
        const msg =
          e?.info?.error?.message ||
          e?.shortMessage ||
          e?.reason ||
          e?.message ||
          'Transaction would revert'
        throw new Error(msg)
      }

      // 2) Gas estimate (buffered). If it fails, we still proceed without gasLimit.
      let gasLimit
      try {
        const est = await ctRead[fnName].estimateGas(...args, { from, value })
        // add generous 20% buffer + small constant
        gasLimit = (est * 12n) / 10n + 50_000n
      } catch {}

      // 3) Fee data from read RPC (some Mini providers don’t support dynamic fee endpoints)
      let feeOverrides = {}
      try {
        const fd = await read.getFeeData()
        // Only include values that exist
        if (fd.maxFeePerGas) feeOverrides.maxFeePerGas = fd.maxFeePerGas
        if (fd.maxPriorityFeePerGas) feeOverrides.maxPriorityFeePerGas = fd.maxPriorityFeePerGas
        // If chain doesn’t have EIP-1559, ethers will ignore these and use gasPrice.
        if (!fd.maxFeePerGas && fd.gasPrice) feeOverrides.gasPrice = fd.gasPrice
      } catch {}

      const overrides = { value }
      if (from) overrides.from = from
      if (gasLimit) overrides.gasLimit = gasLimit
      Object.assign(overrides, feeOverrides)
      return overrides
    },
    [read]
  )

  const createPool1 = useCallback(async ({
    title, theme, parts, word, username, feeBaseWei, durationSecs, blankIndex,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const args = [
      String(title || ''),
      String(theme || ''),
      Array.isArray(parts) ? parts.map(String) : [],
      String(word || ''),
      String(username || ''),
      feeBaseWei,
      BigInt(durationSecs || 0n),
      Number(blankIndex || 0),
    ]

    // Preflight + fee/gas from read-only RPC
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS,
      fillinAbi,
      'createPool1',
      args,
      { from: address, value: feeBaseWei }
    )

    const tx = await fillin.createPool1(...args, overrides)
    return await tx.wait()
  }, [ensureReady, getContracts, estimateWithRead, address])

  const joinPool1 = useCallback(async ({ id, word, username, blankIndex, feeBaseWei }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const poolId = BigInt(id)

    const args = [
      poolId,
      String(word || ''),
      String(username || ''),
      Number(blankIndex || 0),
    ]

    const overrides = await estimateWithRead(
      FILLIN_ADDRESS,
      fillinAbi,
      'joinPool1',
      args,
      { from: address, value: feeBaseWei }
    )

    const tx = await fillin.joinPool1(...args, overrides)
    return await tx.wait()
  }, [ensureReady, getContracts, estimateWithRead, address])

  const claimPool1 = useCallback(async (id) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const poolId = BigInt(id)

    const args = [poolId]

    const overrides = await estimateWithRead(
      FILLIN_ADDRESS,
      fillinAbi,
      'claimPool1',
      args,
      { from: address }
    )

    const tx = await fillin.claimPool1(...args, overrides)
    return await tx.wait()
  }, [ensureReady, getContracts, estimateWithRead, address])

  const mintTemplateNFT = useCallback(async (title, description, theme, parts, { value } = {}) => {
    await ensureReady()
    const { nft } = getContracts(true)

    const args = [
      String(title || ''),
      String(description || ''),
      String(theme || ''),
      Array.isArray(parts) ? parts.map(String) : [],
    ]

    const overrides = await estimateWithRead(
      NFT_ADDRESS,
      nftAbi,
      'mintTemplate',
      args,
      { from: address, value: BigInt(value || 0n) }
    )

    const tx = await nft.mintTemplate(...args, overrides)
    return await tx.wait()
  }, [ensureReady, getContracts, estimateWithRead, address])

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
