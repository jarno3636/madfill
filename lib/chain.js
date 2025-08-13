// lib/chain.js
// SSR-safe chain helpers for Base mainnet (EIP-1193 providers only)

export const BASE_CHAIN_ID_DEC = 8453
export const BASE_CHAIN_ID_HEX = '0x2105'

export const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

export const BASE_EXPLORER =
  process.env.NEXT_PUBLIC_BASE_EXPLORER || 'https://basescan.org'

export const ADD_BASE_PARAMS = Object.freeze({
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base',
  rpcUrls: [BASE_RPC],
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: [BASE_EXPLORER],
})

/** Internal: normalize provider errors for nicer UX */
function formatError(e, fallback = 'Action failed') {
  return e?.shortMessage || e?.reason || e?.message || fallback
}

/**
 * True if a chainId (hex string like '0x2105', or number/bigint) equals Base mainnet.
 * Defensively guards against malformed inputs.
 */
export function isBaseChain(chainId) {
  if (chainId == null || chainId === '') return false
  try {
    if (typeof chainId === 'string') {
      // Accept both hex and decimal strings
      const v = chainId.startsWith('0x') ? BigInt(chainId) : BigInt(Number(chainId))
      return v === BigInt(BASE_CHAIN_ID_DEC)
    }
    return BigInt(chainId) === BigInt(BASE_CHAIN_ID_DEC)
  } catch {
    return false
  }
}

/**
 * Add Base network to the given EIP-1193 provider (injected or mini-app).
 * Throws with a human-readable message on failure.
 */
export async function addBaseChain(provider) {
  if (!provider?.request) throw new Error('No EIP-1193 provider')
  try {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [ADD_BASE_PARAMS],
    })
  } catch (e) {
    throw new Error(formatError(e, 'Unable to add Base network'))
  }
}

/**
 * Switch to Base on the given EIP-1193 provider (injected or mini-app).
 * If chain is unknown (4902), attempts to add then switch again.
 */
export async function switchToBase(provider) {
  if (!provider?.request) throw new Error('No EIP-1193 provider')
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    })
  } catch (e) {
    // 4902 = chain not added
    if (e?.code === 4902) {
      await addBaseChain(provider)
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_CHAIN_ID_HEX }],
        })
      } catch (e2) {
        throw new Error(formatError(e2, 'Unable to switch to Base'))
      }
    } else {
      throw new Error(formatError(e, 'Unable to switch to Base'))
    }
  }
}

/**
 * Ensure the provider is on Base:
 *  - if already on Base, resolves true
 *  - otherwise tries switch, then add+switch
 *  - resolves true on success; throws on failure with readable message
 */
export async function ensureBase(provider) {
  if (!provider?.request) throw new Error('No EIP-1193 provider')
  try {
    // Try reading the current chainId in a provider-agnostic way
    let chainId
    try {
      chainId = await provider.request({ method: 'eth_chainId' })
    } catch {
      chainId = provider.chainId
    }

    if (isBaseChain(chainId)) return true

    await switchToBase(provider)
    return true
  } catch (err) {
    throw new Error(formatError(err, 'Unable to switch to Base'))
  }
}
