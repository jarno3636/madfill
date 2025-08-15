// lib/wallet.js
// Hardened EIP-1193 + Ethers v6 helpers for browser & Farcaster Mini Apps.
// - Prefers injected wallet (Metamask/Coinbase/Trust/etc.)
// - Falls back to Warpcast Mini App provider
// - Polyfills provider.request via send/sendAsync when missing

import { ethers } from 'ethers'

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
export const BASE_CHAIN_ID_DEC = 8453n
export const BASE_CHAIN_ID_HEX = '0x2105'

let _miniProv = null
let _inited = false

const isBrowser = () => typeof window !== 'undefined'
const isWarpcastUA = () =>
  typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)

/** Ensure the provider has a .request method (shim via send/sendAsync when needed). */
function shimEip1193(eip) {
  if (!eip) return null
  if (typeof eip.request === 'function') return eip

  // Some in-app browsers only expose send/sendAsync
  if (typeof eip.send === 'function') {
    eip.request = ({ method, params }) => eip.send(method, params)
    return eip
  }
  if (typeof eip.sendAsync === 'function') {
    eip.request = ({ method, params }) =>
      new Promise((resolve, reject) => {
        eip.sendAsync(
          { id: Date.now(), jsonrpc: '2.0', method, params },
          (err, res) => (err ? reject(err) : resolve(res && res.result))
        )
      })
    return eip
  }
  return eip // last resort; caller should handle failure
}

/** Attempt to get (or lazily load) a Farcaster Mini App wallet provider. */
async function getMiniAppProvider() {
  if (_miniProv) return _miniProv
  if (!isWarpcastUA()) return null
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    const prov = await mod.sdk.wallet.getEthereumProvider()
    _miniProv = prov || null
    return _miniProv
  } catch {
    return null
  }
}

/** Get the best available EIP-1193 provider (injected > mini app), always shimmed. */
export async function getEip1193() {
  if (!isBrowser()) return null
  const injected = typeof window !== 'undefined' ? window.ethereum : null
  if (injected) return shimEip1193(injected)
  const mini = await getMiniAppProvider()
  return shimEip1193(mini)
}

/** BrowserProvider using the *interactive* provider (injected or mini-app). */
export async function getBrowserProvider() {
  const eip = await getEip1193()
  if (!eip) return null
  return new ethers.BrowserProvider(eip)
}

/** Static read-only JSON-RPC provider for Base. */
export function getReadonlyProvider() {
  return new ethers.JsonRpcProvider(BASE_RPC)
}

/** Resolve signer if available, otherwise null. */
export async function getSigner() {
  const bp = await getBrowserProvider()
  if (!bp) return null
  try {
    return await bp.getSigner()
  } catch {
    return null
  }
}

/** Resolve the active EOA address (or null). */
export async function getAddress() {
  const eip = await getEip1193()
  if (!eip) return null
  try {
    const accs = await eip.request?.({ method: 'eth_accounts' })
    if (Array.isArray(accs) && accs[0]) return accs[0]
  } catch {}
  try {
    const accs = await eip.request?.({ method: 'eth_requestAccounts' })
    if (Array.isArray(accs) && accs[0]) return accs[0]
  } catch {}
  return null
}

/** Quick helper: are we currently on Base? (boolean or null if unknown) */
export async function isOnBase() {
  try {
    const bp = await getBrowserProvider()
    if (!bp) return null
    const net = await bp.getNetwork()
    return net?.chainId === BASE_CHAIN_ID_DEC
  } catch { return null }
}

/** Ensure the wallet is on Base; try switch/add chain. Returns true/false. */
export async function ensureBaseChain() {
  const eip = await getEip1193()
  if (!eip) return false

  try {
    const bp = new ethers.BrowserProvider(eip)
    const net = await bp.getNetwork()
    if (net?.chainId === BASE_CHAIN_ID_DEC) return true
  } catch {
    // continue
  }

  // Try to switch
  try {
    if (typeof eip.request === 'function') {
      await eip.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      })
      return true
    }
  } catch (e) {
    if (e && e.code === 4902) {
      // Add chain
      try {
        await eip.request?.({
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
      } catch { return false }
    }
    return false
  }

  // If switching isn’t supported at all (very old providers), fall back to false.
  return false
}

/** Subscribe to account changes. Returns an unsubscribe function. */
export async function onAccountsChanged(cb) {
  const eip = await getEip1193()
  if (!eip?.on) return () => {}
  const handler = (accs) => cb(Array.isArray(accs) && accs[0] ? accs[0] : null)
  eip.on('accountsChanged', handler)
  return () => { try { eip.removeListener?.('accountsChanged', handler) } catch {} }
}

/** Subscribe to chain changes. Returns an unsubscribe function. */
export async function onChainChanged(cb) {
  const eip = await getEip1193()
  if (!eip?.on) return () => {}
  const handler = (hex) => cb(hex)
  eip.on('chainChanged', handler)
  return () => { try { eip.removeListener?.('chainChanged', handler) } catch {} }
}

/** Warm the mini-app provider inside Warpcast so users appear connected right away. */
export async function initWallet() {
  if (_inited) return
  _inited = true
  if (isWarpcastUA()) {
    await getMiniAppProvider().catch(() => {})
  }
}

/** Shorten an address for UI. */
export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
