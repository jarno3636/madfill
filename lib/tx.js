// lib/tx.js
import { ethers } from 'ethers'
import { ensureBaseChain, getBrowserProvider, getReadonlyProvider } from '@/lib/wallet'
import FillinAbi from '@/abi/FillInStoryV3_ABI.json'

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // fallback for local dev

/** ---------------- Error helper (ethers v6 friendly) ---------------- */
export function extractRevert(e) {
  const guess =
    e?.shortMessage ||
    e?.reason ||
    e?.error?.message ||
    e?.info?.error?.message ||
    e?.data?.message ||
    e?.message

  const payload = e?.data || e?.error?.data || e?.info?.error?.data || null
  if (!payload) return guess || 'Transaction failed'

  try {
    const iface = new ethers.Interface(['function Error(string)'])
    const [reason] = iface.decodeErrorResult('Error', payload)
    if (reason) return String(reason)
  } catch {}
  try {
    const iface = new ethers.Interface(['function Panic(uint256)'])
    const [code] = iface.decodeErrorResult('Panic', payload)
    if (code) return `Panic: 0x${BigInt(code).toString(16)}`
  } catch {}
  return guess || 'Transaction would revert'
}

/** ---------------- Low-level helpers ---------------- */
export function readContract(address = CONTRACT_ADDRESS, abi = FillinAbi) {
  const provider = getReadonlyProvider()
  return new ethers.Contract(address, abi, provider)
}

export async function writeContract(address = CONTRACT_ADDRESS, abi = FillinAbi) {
  const ok = await ensureBaseChain()
  if (!ok) throw new Error('Please switch to Base')
  const bp = await getBrowserProvider()
  if (!bp) throw new Error('Wallet not found')
  const signer = await bp.getSigner()
  return new ethers.Contract(address, abi, signer)
}

/** ---------------- High-level tx helpers ---------------- */
/**
 * Create Pool 1
 * params = {
 *   title, theme, parts (string[]), word, username,
 *   feeBaseWei (bigint), durationSecs (bigint), blankIndex (number)
 * }
 */
export async function createPool1Tx(params) {
  const {
    title = '',
    theme = '',
    parts = [],
    word = '',
    username = '',
    feeBaseWei = 0n,
    durationSecs = 0n,
    blankIndex = 0,
    address = CONTRACT_ADDRESS, // optional override
  } = params || {}

  const ct = await writeContract(address, FillinAbi)
  const value = BigInt(feeBaseWei || 0n)

  try {
    // Preflight for revert reasons
    await ct.createPool1.staticCall(
      String(title).slice(0, 128),
      String(theme).slice(0, 128),
      parts,
      String(word),
      String(username).slice(0, 64),
      value,
      BigInt(durationSecs || 0n),
      Number(blankIndex) & 0xff,
      { value }
    )
  } catch (e) {
    throw new Error(extractRevert(e))
  }

  const tx = await ct.createPool1(
    String(title).slice(0, 128),
    String(theme).slice(0, 128),
    parts,
    String(word),
    String(username).slice(0, 64),
    value,
    BigInt(durationSecs || 0n),
    Number(blankIndex) & 0xff,
    { value }
  )
  return tx.wait()
}

/**
 * Join Pool 1
 * params = { id (bigint|number|string), word, username, blankIndex, feeBaseWei }
 */
export async function joinPool1Tx(params) {
  const { id, word = '', username = '', blankIndex = 0, feeBaseWei = 0n, address = CONTRACT_ADDRESS } = params || {}
  const ct = await writeContract(address, FillinAbi)
  const value = BigInt(feeBaseWei || 0n)

  try {
    await ct.joinPool1.staticCall(BigInt(id), String(word), String(username).slice(0, 32), Number(blankIndex) & 0xff, { value })
  } catch (e) {
    throw new Error(extractRevert(e))
  }

  const tx = await ct.joinPool1(BigInt(id), String(word), String(username).slice(0, 32), Number(blankIndex) & 0xff, { value })
  return tx.wait()
}

/**
 * Claim Pool 1
 * params = { id, address? }
 */
export async function claimPool1Tx(params) {
  const { id, address = CONTRACT_ADDRESS } = params || {}
  const ct = await writeContract(address, FillinAbi)

  try {
    await ct.claimPool1.staticCall(BigInt(id))
  } catch (e) {
    throw new Error(extractRevert(e))
  }

  const tx = await ct.claimPool1(BigInt(id))
  return tx.wait()
}
