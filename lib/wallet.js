// /lib/wallet.js
// Farcaster-first EIP-1193 + ethers helpers (JS)

import { ethers } from 'ethers'

export const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
export const BASE_CHAIN_ID = 8453n
export const BASE_CHAIN_ID_HEX = '0x2105'
export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // fallback, but env should be set

export function isWarpcast() {
  if (typeof navigator === 'undefined') return false
  return /Warpcast/i.test(navigator.userAgent || '')
}

/** Mini app provider (if present), else injected, else null. */
export async function getEip1193() {
  // 1) Farcaster Mini App
  if (isWarpcast()) {
    try {
      const mod = await import('@farcaster/miniapp-sdk')
      const prov = await mod.sdk.wallet.getEthereumProvider()
      // Some older/minimal providers may not have .request; normalize a bit
      if (prov && typeof prov.request === 'function') return prov
      // If the mini provider doesn’t expose request (shouldn’t happen now), return null and we’ll try injected
    } catch {
      // ignore
    }
  }
  // 2) Injected wallet
  if (typeof window !== 'undefined' && window.ethereum) return window.ethereum
  // 3) None
  return null
}

/** Read-only JSON-RPC provider for Base */
export function getReadProvider() {
  return new ethers.JsonRpcProvider(BASE_RPC)
}

/** Wrap an EIP-1193 into ethers BrowserProvider */
export async function getBrowserProvider() {
  const eip = await getEip1193()
  if (!eip) return null
  return new ethers.BrowserProvider(eip)
}

export async function getSigner() {
  const bp = await getBrowserProvider()
  if (!bp) return null
  try {
    await bp.send('eth_requestAccounts', [])
  } catch {}
  try {
    return await bp.getSigner()
  } catch {
    return null
  }
}

export async function getAddress() {
  try {
    const s = await getSigner()
    return s ? await s.getAddress() : null
  } catch {
    return null
  }
}

/** Chain id from current provider (null if unknown) */
export async function getChainId() {
  try {
    const bp = await getBrowserProvider()
    if (!bp) return null
    const net = await bp.getNetwork()
    return net?.chainId ?? null
  } catch {
    return null
  }
}

/**
 * Ensure Base chain.
 * - In Warpcast Mini Apps: NO-OP (Wallet is fixed to Base).
 * - In injected wallets: tries wallet_switchEthereumChain, and add if needed.
 */
export async function ensureBaseChain() {
  if (isWarpcast()) return true // Base only
  const eip = await getEip1193()
  if (!eip || typeof eip.request !== 'function') return false
  try {
    await eip.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID_HEX }] })
    return true
  } catch (e) {
    if (e && (e.code === 4902 || e.message?.includes('Unrecognized chain ID'))) {
      try {
        await eip.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base',
            rpcUrls: [BASE_RPC],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://basescan.org'],
          }]
        })
        return true
      } catch {
        return false
      }
    }
    return false
  }
}

/** Small helper: short address for UI */
export function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''
}
