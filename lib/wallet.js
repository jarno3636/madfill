// lib/wallet.js
import { ethers } from 'ethers'

/**
 * Env + constants
 */
export const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

// Ethers v6 network.chainId is a bigint. Keep everything in bigint for comparisons.
export const BASE_CHAIN_ID = 8453n
export const BASE_CHAIN_ID_DEC = BASE_CHAIN_ID
export const BASE_CHAIN_ID_HEX = '0x2105'

/**
 * SSR-safe userAgent checks
 */
export function isClient() {
  return typeof window !== 'undefined'
}
export function isWarpcast() {
  if (!isClient()) return false
  try {
    return /Warpcast/i.test(navigator.userAgent || '')
  } catch {
    return false
  }
}

/**
 * Mini App provider loader (SSR-safe)
 * Returns EIP-1193 or null
 */
let _miniProvider = null
export async function getMiniProvider() {
  if (!isClient()) return null
  if (!isWarpcast()) return null
  if (_miniProvider) return _miniProvider
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    _miniProvider = await mod.sdk.wallet.getEthereumProvider()
    // Some mini providers don’t have .request – shim it
    if (_miniProvider && typeof _miniProvider.request !== 'function') {
      _miniProvider.request = async (args) => _miniProvider.send?.(args?.method, args?.params || [])
    }
    return _miniProvider
  } catch {
    return null
  }
}

/**
 * Unified EIP-1193 getter:
 * 1) Warpcast Mini App
 * 2) Injected window.ethereum
 */
export async function getEip1193() {
  const mini = await getMiniProvider()
  if (mini) return mini
  if (isClient() && window.ethereum) {
    // ensure request exists (older providers)
    if (typeof window.ethereum.request !== 'function' && typeof window.ethereum.send === 'function') {
      window.ethereum.request = async (args) => window.ethereum.send(args?.method, args?.params || [])
    }
    return window.ethereum
  }
  return null
}

/**
 * Read-only provider (no wallet needed)
 */
let _readProvider = null
export function getReadonlyProvider() {
  if (_readProvider) return _readProvider
  _readProvider = new ethers.JsonRpcProvider(BASE_RPC)
  return _readProvider
}
// Back-compat alias (your code imports this)
export const getReadProvider = getReadonlyProvider

/**
 * BrowserProvider from current wallet (Mini App or injected)
 */
export async function getBrowserProvider() {
  const eip = await getEip1193()
  if (!eip) return null
  return new ethers.BrowserProvider(eip)
}

/**
 * Init early (no-op on SSR). Useful to “warm up” Mini App wallet.
 */
export async function initWallet() {
  try { await getMiniProvider() } catch {}
}

/**
 * Current chain id (bigint) or null
 */
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
 * Current address or null. Will NOT trigger connect UI.
 */
export async function getAddress() {
  try {
    const eip = await getEip1193()
    if (!eip?.request) return null
    const accounts = await eip.request({ method: 'eth_accounts' })
    return Array.isArray(accounts) && accounts[0] ? accounts[0] : null
  } catch {
    return null
  }
}

/**
 * Ensure Base is the active chain (switch or add). Returns true if on Base.
 */
export async function ensureBaseChain() {
  const eip = await getEip1193()
  if (!eip?.request) return false
  try {
    // Do not force connect here; let the dapp call eth_requestAccounts when it needs to sign
    const bp = await getBrowserProvider()
    const net = await bp?.getNetwork()
    if (net?.chainId === BASE_CHAIN_ID) return true

    await eip.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    })
    return true
  } catch (e) {
    if (e && (e.code === 4902 || e.code === '4902')) {
      try {
        await eip.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base',
            rpcUrls: [BASE_RPC],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://basescan.org'],
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

/**
 * Events
 */
export async function onAccountsChanged(cb) {
  const eip = await getEip1193()
  if (!eip?.on) return () => {}
  const handler = (accs) => cb(accs?.[0] || null)
  eip.on('accountsChanged', handler)
  return () => { try { eip.removeListener?.('accountsChanged', handler) } catch {} }
}

export async function onChainChanged(cb) {
  const eip = await getEip1193()
  if (!eip?.on) return () => {}
  const handler = () => cb()
  eip.on('chainChanged', handler)
  return () => { try { eip.removeListener?.('chainChanged', handler) } catch {} }
}
