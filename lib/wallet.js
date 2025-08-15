// lib/wallet.js
// Unified, SSR-safe wallet helpers for browser & Farcaster Mini App (ethers v6).

import { ethers } from 'ethers'

/** ---------- Chain & RPC ---------- */
export const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
export const BASE_CHAIN_ID_DEC = 8453n
export const BASE_CHAIN_ID_HEX = '0x2105' // 8453
export const BASE_EXPLORER = 'https://basescan.org'

/** ---------- Contract addrs (read via env) ---------- */
export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // fallback only

/** ---------- Environment checks ---------- */
export function isBrowser() {
  return typeof window !== 'undefined'
}
export function isWarpcast() {
  if (typeof navigator === 'undefined') return false
  return /Warpcast/i.test(navigator.userAgent || '')
}

/** ---------- Internal provider cache ---------- */
let cachedMini = null       // EIP-1193 from Farcaster Mini
let cachedInjected = null   // window.ethereum
let injectedChecked = false

async function getMiniProvider() {
  if (!isWarpcast()) return null
  if (cachedMini) return cachedMini
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    const prov = await mod.sdk.wallet.getEthereumProvider()
    cachedMini = prov || null
    return cachedMini
  } catch {
    return null
  }
}

function getInjected() {
  if (!isBrowser()) return null
  if (!injectedChecked) {
    cachedInjected = window.ethereum || null
    injectedChecked = true
  }
  return cachedInjected
}

/** ---------- Preferred EIP-1193 provider (Mini → Injected) ---------- */
export async function getEip1193() {
  const mini = await getMiniProvider()
  if (mini) return mini
  const inj = getInjected()
  if (inj) return inj
  return null
}

/** ---------- ethers providers ---------- */
export async function getBrowserProvider() {
  const eip = await getEip1193()
  if (!eip) return null
  return new ethers.BrowserProvider(eip)
}
export function getReadonlyProvider() {
  return new ethers.JsonRpcProvider(BASE_RPC)
}

/** ---------- Account & chain helpers ---------- */
export async function getAddress() {
  try {
    const bp = await getBrowserProvider()
    const signer = await bp?.getSigner()
    const addr = await signer?.getAddress()
    return addr || null
  } catch { return null }
}

export async function getChainId() {
  try {
    const bp = await getBrowserProvider()
    const net = await bp?.getNetwork()
    return net?.chainId ?? null
  } catch { return null }
}

/** Ensure Base; returns boolean success */
export async function ensureBaseChain(external) {
  // Warpcast is fixed to Base; nothing to do
  if (isWarpcast()) return true

  const eip = external?.provider || external || (await getEip1193())
  if (!eip?.request) return false

  try {
    await eip.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    })
    return true
  } catch (e) {
    // Add chain if unknown
    if (e?.code === 4902 || /Unrecognized chain/i.test(String(e?.message))) {
      try {
        await eip.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base',
            rpcUrls: [BASE_RPC],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: [BASE_EXPLORER],
          }],
        })
        return true
      } catch {
        return false
      }
    }
    return false
  }
}

/** Event helpers: return an "off" function */
export async function onAccountsChanged(cb) {
  const eip = await getEip1193()
  if (!eip?.on) return () => {}
  const h = (accs) => cb?.(Array.isArray(accs) && accs[0] ? accs[0] : null)
  eip.on('accountsChanged', h)
  return () => { try { eip.removeListener?.('accountsChanged', h) } catch {} }
}
export async function onChainChanged(cb) {
  const eip = await getEip1193()
  if (!eip?.on) return () => {}
  const h = () => cb?.()
  eip.on('chainChanged', h)
  return () => { try { eip.removeListener?.('chainChanged', h) } catch {} }
}

/** Optional boot: prewarm Mini wallet so users appear connected in Warpcast */
export async function initWallet() {
  if (!isBrowser()) return
  if (isWarpcast()) { try { await getMiniProvider() } catch {} }
}

/** UI helper */
export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
