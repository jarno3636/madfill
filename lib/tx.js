// lib/tx.js
import { ethers } from 'ethers'

export const BASE_CHAIN_ID = 8453
export const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

/**
 * Get a BrowserProvider that works in-browser AND in Warpcast Mini.
 * - Prefers injected (MetaMask/etc)
 * - Falls back to Warpcast Mini wallet if available
 * - Forces a static Base network to avoid provider quirks
 */
export async function getBrowserProvider() {
  // injected first
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum, { chainId: BASE_CHAIN_ID, name: 'base' })
  }

  // mini wallet
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    const eip = await mod.sdk.wallet.getEthereumProvider()
    if (eip) {
      return new ethers.BrowserProvider(eip, { chainId: BASE_CHAIN_ID, name: 'base' })
    }
  } catch {} // not in mini

  // last resort (read-only)
  return new ethers.BrowserProvider(new ethers.JsonRpcProvider(BASE_RPC), { chainId: BASE_CHAIN_ID, name: 'base' })
}

/**
 * Try to decode a revert reason using the ABI (ethers v6)
 */
export function decodeRevert(err, iface) {
  try {
    const data =
      err?.error?.data ??        // some providers
      err?.info?.error?.data ??  // ethers wrapped
      err?.data ??               // raw
      null

    if (!data || typeof data !== 'string') return null

    // Panic/standard errors
    if (data.startsWith('0x08c379a0')) {
      const [reason] = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + data.slice(10))
      return String(reason || '').trim()
    }

    // Custom errors via ABI
    if (iface) {
      try {
        const dec = iface.parseError(data)
        if (dec) return `${dec.name}(${dec.args?.map(String).join(', ')})`
      } catch {}
    }
  } catch {}
  return null
}

/**
 * Preflight + send contract tx, surfacing readable errors.
 * - staticCall guards against “missing revert data” during estimation
 * - we also try estimateGas and fall back to a padded gasLimit
 */
export async function preflightAndSend({
  contract, // ethers.Contract (connected with signer)
  iface,    // ethers.Interface (optional but improves errors)
  method,   // string method name
  args = [], 
  valueWei = 0n,
}) {
  // 1) static call (simulate)
  try {
    const fn = contract[method]
    if (!fn?.staticCall) throw new Error(`Method ${method} not found`)
    await fn.staticCall(...args, { value: valueWei })
  } catch (e) {
    const reason = decodeRevert(e, iface)
    throw new Error(reason || (e?.shortMessage || e?.message || 'Transaction would revert'))
  }

  // 2) estimate gas (may still fail on Mini, but we tried)
  let gasLimit
  try {
    const est = await contract[method].estimateGas(...args, { value: valueWei })
    gasLimit = (est * 110n) / 100n // +10% buffer
  } catch {
    // safe fallback
    gasLimit = 300000n
  }

  // 3) send
  try {
    const tx = await contract[method](...args, { value: valueWei, gasLimit })
    return await tx.wait()
  } catch (e) {
    const reason = decodeRevert(e, iface)
    throw new Error(reason || (e?.shortMessage || e?.message || 'Transaction failed'))
  }
}
