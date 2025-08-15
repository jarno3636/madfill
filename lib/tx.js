// lib/tx.js
import { ethers } from 'ethers'
import { getReadonlyProvider, getBrowserProvider, ensureBaseChain } from '@/lib/wallet'

/**
 * Read-only contract instance
 */
export function readContract(address, abi) {
  const provider = getReadonlyProvider()
  return new ethers.Contract(address, abi, provider)
}

/**
 * Write contract instance (ensures Base). Will prompt connect on sign.
 */
export async function writeContract(address, abi) {
  const ok = await ensureBaseChain()
  if (!ok) throw new Error('Please switch to Base')
  const bp = await getBrowserProvider()
  if (!bp) throw new Error('Wallet not found')
  const signer = await bp.getSigner()
  return new ethers.Contract(address, abi, signer)
}
