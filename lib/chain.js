// lib/chain.js
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

/** True if a chainId (hex string or bigint/number) equals Base mainnet */
export function isBaseChain(chainId) {
  if (typeof chainId === 'string') {
    // normalize hex like '0x2105'
    try {
      return BigInt(chainId) === BigInt(BASE_CHAIN_ID_DEC)
    } catch {
      return false
    }
  }
  try {
    return BigInt(chainId) === BigInt(BASE_CHAIN_ID_DEC)
  } catch {
    return false
  }
}

/** Add Base network to the given EIP-1193 provider (injected or mini-app) */
export async function addBaseChain(provider) {
  if (!provider?.request) throw new Error('No EIP-1193 provider')
  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [ADD_BASE_PARAMS],
  })
}

/** Switch to Base on the given EIP-1193 provider (injected or mini-app) */
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
      // try again after adding
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      })
    } else {
      throw e
    }
  }
}

/**
 * Ensure the provider is on Base:
 *  - if already on Base, returns true immediately
 *  - otherwise tries switch, then add+switch
 *  - returns true on success; throws on failure
 */
export async function ensureBase(provider) {
  if (!provider?.request) throw new Error('No EIP-1193 provider')

  try {
    // Try reading the current chainId in a provider-agnostic way
    let chainId
    try {
      chainId = await provider.request({ method: 'eth_chainId' })
    } catch {
      // some wrappers expose chainId directly
      chainId = provider.chainId
    }

    if (isBaseChain(chainId)) return true

    await switchToBase(provider)
    return true
  } catch (err) {
    // surface a clearer error upstream
    throw new Error(
      typeof err?.message === 'string' ? err.message : 'Unable to switch to Base'
    )
  }
}
