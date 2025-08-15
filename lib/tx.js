// /lib/tx.js
// Contract calls for FillInStoryV3 with preflight + friendly errors (JS)

import { ethers } from 'ethers'
import FillInAbi from '@/abi/FillInStoryV3_ABI.json'
import {
  CONTRACT_ADDRESS,
  BASE_CHAIN_ID,
  getReadProvider,
  getBrowserProvider,
  ensureBaseChain,
} from '@/lib/wallet'

// -------- Error decoding ----------
function decodeRevert(e) {
  const guess =
    e?.shortMessage ||
    e?.reason ||
    e?.error?.message ||
    e?.info?.error?.message ||
    e?.data?.message ||
    e?.message

  const payload = e?.data || e?.error?.data || e?.info?.error?.data || null

  // Empty or "missing revert data"
  if (!payload || /missing revert data/i.test(String(guess || ''))) {
    return 'Transaction reverted (no message). Check function name, params, and value.'
  }

  try {
    // Try Error(string)
    const iface = new ethers.Interface(['error Error(string)'])
    const { args } = iface.parseError(payload)
    if (args?.[0]) return String(args[0])
  } catch {}

  try {
    // Try Panic(uint256)
    const iface2 = new ethers.Interface(['error Panic(uint256)'])
    const { args } = iface2.parseError(payload)
    if (args?.[0] != null) return `Panic 0x${BigInt(args[0]).toString(16)}`
  } catch {}

  return guess || 'Transaction failed'
}

function getWriteContract(signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, FillInAbi, signer)
}
function getReadContract() {
  return new ethers.Contract(CONTRACT_ADDRESS, FillInAbi, getReadProvider())
}

// -------- Reads (nice to have) ----------
export async function getFeeBps() {
  try {
    const c = getReadContract()
    const [fee, den] = await Promise.all([c.FEE_BPS(), c.BPS_DENOMINATOR()])
    return { feeBps: Number(fee), bpsDen: Number(den) }
  } catch {
    return { feeBps: null, bpsDen: 10000 }
  }
}

// -------- Writes ----------
/**
 * Create Pool 1
 * @param {object} p
 * @param {string} p.title
 * @param {string} p.theme
 * @param {string[]} p.parts
 * @param {string} p.word        (one word)
 * @param {string} p.username    (optional)
 * @param {bigint} p.feeBaseWei  (wei) also sent as value
 * @param {bigint} p.durationSecs
 * @param {number} p.blankIndex  (0..255)
 * @returns {string} tx hash
 */
export async function createPool1Tx(p) {
  const bp = await getBrowserProvider()
  if (!bp) throw new Error('Wallet not found')
  try { await bp.send('eth_requestAccounts', []) } catch {}

  // In normal wallets, ensure chain; in Warpcast it’s a no-op
  await ensureBaseChain()
  const net = await bp.getNetwork()
  if (net?.chainId !== BASE_CHAIN_ID) {
    throw new Error('Please switch to Base network')
  }

  const signer = await bp.getSigner()
  const ct = getWriteContract(signer)

  const args = [
    String(p.title || '').slice(0, 128),
    String(p.theme || '').slice(0, 128),
    Array.isArray(p.parts) ? p.parts : [],
    String(p.word || ''),
    String(p.username || '').slice(0, 64),
    BigInt(p.feeBaseWei ?? 0n),
    BigInt(p.durationSecs ?? 0n),
    Number(p.blankIndex ?? 0) & 0xff,
  ]
  const overrides = { value: BigInt(p.feeBaseWei ?? 0n) }

  // Preflight
  try {
    await ct.createPool1.staticCall(...args, overrides)
  } catch (e) {
    throw new Error(decodeRevert(e))
  }

  // Send
  try {
    const tx = await ct.createPool1(...args, overrides)
    const rec = await tx.wait()
    return rec?.hash || tx?.hash
  } catch (e) {
    throw new Error(decodeRevert(e))
  }
}

/**
 * Join Pool 1
 * @param {object} p
 * @param {string|number|bigint} p.id
 * @param {string} p.word
 * @param {string} p.username
 * @param {number} p.blankIndex
 * @param {bigint} p.feeBaseWei
 * @returns {string} tx hash
 */
export async function joinPool1Tx(p) {
  const bp = await getBrowserProvider()
  if (!bp) throw new Error('Wallet not found')
  try { await bp.send('eth_requestAccounts', []) } catch {}

  await ensureBaseChain()
  const net = await bp.getNetwork()
  if (net?.chainId !== BASE_CHAIN_ID) throw new Error('Please switch to Base network')

  const signer = await bp.getSigner()
  const ct = getWriteContract(signer)

  const id = BigInt(p.id)
  const args = [
    id,
    String(p.word || ''),
    String(p.username || '').slice(0, 32),
    Number(p.blankIndex ?? 0) & 0xff,
  ]
  const overrides = { value: BigInt(p.feeBaseWei ?? 0n) }

  try {
    await ct.joinPool1.staticCall(...args, overrides)
  } catch (e) {
    throw new Error(decodeRevert(e))
  }

  try {
    const tx = await ct.joinPool1(...args, overrides)
    const rec = await tx.wait()
    return rec?.hash || tx?.hash
  } catch (e) {
    throw new Error(decodeRevert(e))
  }
}
