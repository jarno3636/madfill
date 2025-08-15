// /lib/wallet.js
import { ethers } from 'ethers'

export const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
export const BASE_CHAIN_ID = 8453n
export const BASE_CHAIN_ID_HEX = '0x2105'
export const EXPLORER = 'https://basescan.org'

export function isWarpcast() {
  return typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)
}

export async function getMiniProvider() {
  if (!isWarpcast()) return null
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    return await mod.sdk.wallet.getEthereumProvider()
  } catch {
    return null
  }
}

export async function getEip1193() {
  if (typeof window !== 'undefined' && window.ethereum) {
    return window.ethereum
  }
  const mini = await getMiniProvider()
  return mini || null
}

export async function getBrowserProvider() {
  const eip = await getEip1193()
  return eip ? new ethers.BrowserProvider(eip) : null
}

export function getReadProvider() {
  return new ethers.JsonRpcProvider(BASE_RPC)
}

export async function ensureBaseChain(eip1193) {
  const eip = eip1193 || (await getEip1193())
  if (!eip) throw new Error('No wallet provider found.')

  try {
    await eip.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    })
    return
  } catch (e) {
    if (e.code !== 4902) throw e
  }

  await eip.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: BASE_CHAIN_ID_HEX,
      chainName: 'Base',
      rpcUrls: [BASE_RPC],
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      blockExplorerUrls: [EXPLORER],
    }],
  })
}

export async function getChainId(provider) {
  if (!provider) return null
  try {
    const net = await provider.getNetwork()
    return net ? net.chainId : null
  } catch {
    return null
  }
}
