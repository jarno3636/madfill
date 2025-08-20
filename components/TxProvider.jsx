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

/** ---------- Contracts (Base mainnet) ---------- */
const FILLIN_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  '0xCA699Fb766E3FaF36AC31196fb4bd7184769DD20'

/** ---------- Fee buffer (BPS) ---------- */
const FEE_BUFFER_BPS = (() => {
  const v = Number(process.env.NEXT_PUBLIC_MYO_FEE_BUFFER_BPS)
  return Number.isFinite(v) && v >= 0 && v <= 5000 ? Math.floor(v) : 200 // +2%
})()

/** ---------- Context ---------- */
const TxContext = createContext(null)

/** ---------- Utils ---------- */
const clampU8 = (n) => (Math.max(0, Math.min(255, Number(n ?? 0))) | 0)
const toBig = (v) => ethers.toBigInt(v ?? 0n)

function buildBufferedOverrides({ from, value, gasLimitBase = 250_000, gasJitter = 50_000 }) {
  const overrides = {}
  if (from) overrides.from = from
  if (value !== undefined && value !== null) overrides.value = ethers.toBigInt(value)
  overrides.gasLimit =
    BigInt(gasLimitBase) + BigInt(Math.floor(Math.random() * Math.max(1, gasJitter)))
  return overrides
}

/** Build a tx request for frames (to, data, value, chainId) */
function buildTxRequest(contractAddress, abi, fnName, args, { value, chainId = BASE_CHAIN_ID } = {}) {
  const iface = new ethers.Interface(abi)
  const data = iface.encodeFunctionData(fnName, args)
  return {
    to: contractAddress,
    data,
    value: value != null ? ethers.toBeHex(ethers.toBigInt(value)) : undefined,
    chainId: Number(chainId),
  }
}

export function TxProvider({ children }) {
  const { provider, signer, isOnBase, connect, switchToBase, address, isWarpcast } = useWallet()

  const [txStatus, setTxStatus] = useState(null)   // 'pending' | 'success' | 'error' | null
  const [pendingTx, setPendingTx] = useState(null) // hash
  const [lastTx, setLastTx] = useState(null)       // receipt

  /** read-only provider (no signer) — recreate if RPC changes & pin network */
  const read = useMemo(
    () => new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true }),
    [BASE_RPC]
  )

  /** expose read-only helpers */
  const getReadProvider = useCallback(() => read, [read])
  const getNftReadContract = useCallback(
    () => new ethers.Contract(NFT_ADDRESS, nftAbi, read),
    [read]
  )

  /** contracts (read or write) */
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

  /** Ensure wallet + network — don’t force switch inside Warpcast frames */
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

  /** Preflight + gas estimate via read-only runner */
  const estimateWithRead = useCallback(
    async (contractAddress, abi, fnName, args, { from, value } = {}) => {
      const ctRead = new ethers.Contract(contractAddress, abi, read)

      try {
        const overrides = {}
        if (value !== undefined && value !== null) overrides.value = ethers.toBigInt(value)
        if (from) overrides.from = from
        await ctRead[fnName].staticCall(...args, overrides)
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
        const est = await ctRead[fnName].estimateGas?.(...args, overrides)
        if (est) overrides.gasLimit = (est * 12n) / 10n + 50_000n // +20% + buffer
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

  /** Decide to send, or return calldata for frames */
  const maybeSendOrReturn = useCallback(
    async ({ contract, contractAddress, abi, fnName, args, value, overrides, asCalldata }) => {
      const shouldReturn = Boolean(asCalldata) || (isWarpcast && !signer)
      if (shouldReturn) {
        return buildTxRequest(contractAddress, abi, fnName, args, { value, chainId: BASE_CHAIN_ID })
      }
      return await runTx(() => contract[fnName](...args, overrides))
    },
    [isWarpcast, signer]
  )

  /* =========================
     READ HELPERS (NFT)
  ========================= */
  const readMintPriceWei = useCallback(async () => {
    const { nft } = getContracts(false)
    try {
      const onchain = await nft.getMintPriceWei?.().catch(() => null)
      return onchain && onchain > 0n ? onchain : await nft.mintPriceWei?.().catch(() => 0n)
    } catch {
      return 0n
    }
  }, [getContracts])

  const readPaused = useCallback(async () => {
    const { nft } = getContracts(false)
    try {
      return Boolean(await nft.paused())
    } catch {
      return false
    }
  }, [getContracts])

  const readNftLimits = useCallback(async () => {
    const { nft } = getContracts(false)
    const safe = async (name, fallback) => {
      try { const v = await nft[name]() ; return typeof v === 'bigint' ? Number(v) : v } catch { return fallback }
    }
    return {
      BLANK: await safe('BLANK', '[BLANK]'),
      MAX_PARTS: await safe('MAX_PARTS', 24),
      MAX_PART_BYTES: await safe('MAX_PART_BYTES', 96),
      MAX_TOTAL_BYTES: await safe('MAX_TOTAL_BYTES', 4096),
      MAX_TITLE_BYTES: await safe('MAX_TITLE_BYTES', 128),
      MAX_THEME_BYTES: await safe('MAX_THEME_BYTES', 128),
      MAX_DESC_BYTES: await safe('MAX_DESC_BYTES', 2048),
      paused: await readPaused(),
      mintPriceWei: await readMintPriceWei(),
    }
  }, [getContracts, readPaused, readMintPriceWei])

  /** Quick-read helpers for gallery/detail pages */
  const readTemplateOf = useCallback(async (tokenId) => {
    const { nft } = getContracts(false)
    try {
      const res = await nft.templateOf(ethers.toBigInt(tokenId))
      return {
        title: String(res?.[0] ?? ''),
        description: String(res?.[1] ?? ''),
        theme: String(res?.[2] ?? ''),
        parts: Array.isArray(res?.[3]) ? res[3].map(String) : [],
        createdAt: typeof res?.[4] === 'bigint' ? Number(res[4]) : Number(res?.createdAt ?? 0),
        author: String(res?.[5] ?? '0x0000000000000000000000000000000000000000'),
      }
    } catch (e) {
      console.warn('readTemplateOf error:', e)
      return null
    }
  }, [getContracts])

  /** Batch version (optional) */
  const readTemplatesBatch = useCallback(async (tokenIds = []) => {
    if (!Array.isArray(tokenIds) || tokenIds.length === 0) return []
    const nft = getNftReadContract()
    const calls = tokenIds.map(async (id) => {
      try {
        const r = await nft.templateOf(ethers.toBigInt(id))
        return {
          id: Number(id),
          title: String(r?.[0] ?? ''),
          description: String(r?.[1] ?? ''),
          theme: String(r?.[2] ?? ''),
          parts: Array.isArray(r?.[3]) ? r[3].map(String) : [],
          createdAt: typeof r?.[4] === 'bigint' ? Number(r[4]) : Number(r?.createdAt ?? 0),
          author: String(r?.[5] ?? '0x0000000000000000000000000000000000000000'),
        }
      } catch { return { id: Number(id), __error: true } }
    })
    return await Promise.all(calls)
  }, [getNftReadContract])

  const readTokenURI = useCallback(async (tokenId) => {
    const { nft } = getContracts(false)
    try {
      return await nft.tokenURI(ethers.toBigInt(tokenId))
    } catch (e) {
      console.warn('readTokenURI error:', e)
      return ''
    }
  }, [getContracts])

  const readTotalSupply = useCallback(async () => {
    const { nft } = getContracts(false)
    try {
      const ts = await nft.totalSupply()
      return typeof ts === 'bigint' ? ts : ethers.toBigInt(ts ?? 0)
    } catch (e) {
      console.warn('readTotalSupply error:', e)
      return 0n
    }
  }, [getContracts])

  /* =========================
     POOL 1
  ========================= */
  const createPool1 = useCallback(async ({
    title, theme, parts, word, username, feeBaseWei, durationSecs, blankIndex,
    asCalldata = false,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const fee = toBig(feeBaseWei)
    const args = [
      String(title ?? ''),
      String(theme ?? ''),
      Array.isArray(parts) ? parts.map((p) => String(p ?? '')) : [],
      String(word ?? ''),
      String(username ?? ''),
      fee,
      toBig(durationSecs),
      clampU8(blankIndex),
    ]
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'createPool1', args, { from: address, value: fee }
    )
    return await maybeSendOrReturn({
      contract: fillin,
      contractAddress: FILLIN_ADDRESS,
      abi: fillinAbi,
      fnName: 'createPool1',
      args,
      value: fee,
      overrides,
      asCalldata,
    })
  }, [ensureReady, getContracts, estimateWithRead, address, maybeSendOrReturn])

  const joinPool1 = useCallback(async ({
    id, word, username, blankIndex, feeBaseWei,
    asCalldata = false,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const poolId = toBig(id)
    const value  = toBig(feeBaseWei)
    const args = [poolId, String(word ?? ''), String(username ?? ''), clampU8(blankIndex)]
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'joinPool1', args, { from: address, value }
    )
    return await maybeSendOrReturn({
      contract: fillin,
      contractAddress: FILLIN_ADDRESS,
      abi: fillinAbi,
      fnName: 'joinPool1',
      args,
      value,
      overrides,
      asCalldata,
    })
  }, [ensureReady, getContracts, estimateWithRead, address, maybeSendOrReturn])

  const claimPool1 = useCallback(async (id, { asCalldata = false } = {}) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const args = [toBig(id)]
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'claimPool1', args, { from: address }
    )
    return await maybeSendOrReturn({
      contract: fillin,
      contractAddress: FILLIN_ADDRESS,
      abi: fillinAbi,
      fnName: 'claimPool1',
      args,
      value: undefined,
      overrides,
      asCalldata,
    })
  }, [ensureReady, getContracts, estimateWithRead, address, maybeSendOrReturn])

  /* =========================
     POOL 2
  ========================= */
  const createPool2 = useCallback(async ({
    pool1Id, challengerWord, challengerUsername, feeBaseWei, durationSecs,
    asCalldata = false,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const value = toBig(feeBaseWei)
    const args = [
      toBig(pool1Id),
      String(challengerWord ?? ''),
      String(challengerUsername ?? ''),
      value,
      toBig(durationSecs),
    ]
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'createPool2', args, { from: address, value }
    )
    return await maybeSendOrReturn({
      contract: fillin,
      contractAddress: FILLIN_ADDRESS,
      abi: fillinAbi,
      fnName: 'createPool2',
      args,
      value,
      overrides,
      asCalldata,
    })
  }, [ensureReady, getContracts, estimateWithRead, address, maybeSendOrReturn])

  const votePool2 = useCallback(async ({
    id, voteChallenger, feeWei,
    asCalldata = false,
  }) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const args = [toBig(id), Boolean(voteChallenger)]
    const value = toBig(feeWei)
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'votePool2', args, { from: address, value }
    )
    return await maybeSendOrReturn({
      contract: fillin,
      contractAddress: FILLIN_ADDRESS,
      abi: fillinAbi,
      fnName: 'votePool2',
      args,
      value,
      overrides,
      asCalldata,
    })
  }, [ensureReady, getContracts, estimateWithRead, address, maybeSendOrReturn])

  const claimPool2 = useCallback(async (id, { asCalldata = false } = {}) => {
    await ensureReady()
    const { fillin } = getContracts(true)
    const args = [toBig(id)]
    const overrides = await estimateWithRead(
      FILLIN_ADDRESS, fillinAbi, 'claimPool2', args, { from: address }
    )
    return await maybeSendOrReturn({
      contract: fillin,
      contractAddress: FILLIN_ADDRESS,
      abi: fillinAbi,
      fnName: 'claimPool2',
      args,
      value: undefined,
      overrides,
      asCalldata,
    })
  }, [ensureReady, getContracts, estimateWithRead, address, maybeSendOrReturn])

  /* =========================
     NFT: mintTemplate (payable)
  ========================= */
  const mintTemplateNFT = useCallback(
    async (title, description, theme, parts, { value, asCalldata = false } = {}) => {
      await ensureReady()
      const { nft } = getContracts(true)

      let finalValue = value != null ? toBig(value) : 0n
      if (finalValue === 0n) {
        const base = await readMintPriceWei()
        const extra = (base * BigInt(FEE_BUFFER_BPS)) / 10_000n
        finalValue = base + extra
      }

      const args = [
        String(title ?? ''),
        String(description ?? ''),
        String(theme ?? ''),
        Array.isArray(parts) ? parts.map((p) => String(p ?? '')) : [],
      ]

      const preflight = await estimateWithRead(
        NFT_ADDRESS, nftAbi, 'mintTemplate', args, { from: address, value: finalValue }
      )

      if (asCalldata || (isWarpcast && !signer)) {
        return buildTxRequest(NFT_ADDRESS, nftAbi, 'mintTemplate', args, {
          value: preflight?.value ?? finalValue,
          chainId: BASE_CHAIN_ID,
        })
      }

      const overrides = buildBufferedOverrides({
        from: address,
        value: preflight?.value ?? finalValue,
        gasLimitBase: Number(preflight?.gasLimit ?? 250_000n),
        gasJitter: 50_000,
      })

      return await runTx(() => nft.mintTemplate(...args, overrides))
    },
    [ensureReady, getContracts, estimateWithRead, address, readMintPriceWei, isWarpcast, signer]
  )

  /** ---------------- Context Value ---------------- */
  const valueCtx = useMemo(() => ({
    // wallet / net
    address,
    isConnected: !!address,
    isOnBase,
    isWarpcast,
    connect,
    switchToBase,
    provider,
    getContracts,

    // Pools (each supports { asCalldata } option)
    createPool1, joinPool1, claimPool1,
    createPool2, votePool2, claimPool2,

    // NFT: write + reads
    mintTemplateNFT,
    readNftLimits,
    readMintPriceWei,
    readPaused,
    readTemplateOf,
    readTemplatesBatch,   // NEW (optional)
    readTokenURI,
    readTotalSupply,

    // read-only primitives (optional)
    getReadProvider,
    getNftReadContract,

    // tx state
    txStatus, pendingTx, lastTx,

    // constants
    BASE_RPC, FILLIN_ADDRESS, NFT_ADDRESS, BASE_CHAIN_ID,
    FEE_BUFFER_BPS,
  }), [
    address, isOnBase, isWarpcast, connect, switchToBase, provider, getContracts,
    createPool1, joinPool1, claimPool1,
    createPool2, votePool2, claimPool2,
    mintTemplateNFT, readNftLimits, readMintPriceWei, readPaused,
    readTemplateOf, readTemplatesBatch, readTokenURI, readTotalSupply,
    getReadProvider, getNftReadContract,
    txStatus, pendingTx, lastTx
  ])

  return <TxContext.Provider value={valueCtx}>{children}</TxContext.Provider>
}

export const useTx = () => useContext(TxContext)
