// lib/farcasterConfig.js

// Centralized Farcaster-related chain config for the app.
// SSR-safe: only reads NEXT_PUBLIC envs and exports plain objects/functions.

const DEFAULT_CHAIN_ID = 8453 // Base mainnet
const DEFAULT_CHAIN_HEX = '0x2105'

export const FARCASTER_CONFIG = Object.freeze({
  defaultChainId: DEFAULT_CHAIN_ID,
  supportedChains: Object.freeze([
    Object.freeze({
      key: 'base',
      id: DEFAULT_CHAIN_ID,
      hex: DEFAULT_CHAIN_HEX,
      name: 'Base',
      rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org',
      blockExplorer: 'https://basescan.org',
      nativeCurrency: Object.freeze({ name: 'ETH', symbol: 'ETH', decimals: 18 }),
    }),
  ]),
})

/**
 * Normalize possible chain id inputs:
 *  - number (e.g., 8453)
 *  - string hex (e.g., '0x2105')
 *  - string decimal (e.g., '8453')
 *  - bigint (e.g., 8453n)
 * Returns a number or null if invalid.
 */
function normalizeId(idLike) {
  if (idLike == null) return null
  try {
    if (typeof idLike === 'number') return Number(idLike)
    if (typeof idLike === 'bigint') return Number(idLike)
    if (typeof idLike === 'string') {
      if (idLike.startsWith('0x') || idLike.startsWith('0X')) {
        return Number(BigInt(idLike))
      }
      const n = Number(idLike)
      return Number.isFinite(n) ? n : null
    }
    return null
  } catch {
    return null
  }
}

/** Convenience accessor for default chain info. */
export function getDefaultChainInfo() {
  return FARCASTER_CONFIG.supportedChains[0]
}

/**
 * Accepts:
 *  - numeric id (e.g., 8453)
 *  - hex string id (e.g., '0x2105')
 *  - decimal string id (e.g., '8453')
 *  - key string (e.g., 'base')
 * Falls back to the default chain info if no exact match found.
 */
export function getChainInfo(idOrKey = FARCASTER_CONFIG.defaultChainId) {
  const chains = FARCASTER_CONFIG.supportedChains

  // Try id-like inputs first
  const maybeId = normalizeId(idOrKey)
  if (maybeId != null) {
    return chains.find((c) => c.id === maybeId) || getDefaultChainInfo()
  }

  // Then try key string
  if (typeof idOrKey === 'string') {
    return chains.find((c) => c.key === idOrKey) || getDefaultChainInfo()
  }

  return getDefaultChainInfo()
}

// Optional named exports for convenience (do not break existing imports)
export const BASE_CHAIN_ID = DEFAULT_CHAIN_ID
export const BASE_CHAIN_HEX = DEFAULT_CHAIN_HEX
