// lib/wallet.js
import { ethers } from 'ethers'

export const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
export const BASE_CHAIN_ID = 8453n
export const BASE_CHAIN_ID_HEX = '0x2105'

/** Detect injected or Farcaster mini-app EIP-1193 */
export async function getEip1193() {
  // 1) Browser-injected wallet
  if (typeof window !== 'undefined' && window.ethereum) return window.ethereum

  // 2) Farcaster Mini App
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    // Make sure SDK is “awake” if present
    try { await mod.sdk?.ready?.() } catch {}
    const prov = await mod.sdk?.wallet?.getEthereumProvider()
    return prov || null
  } catch {
    return null
  }
}

export async function getBrowserProvider() {
  const eip = await getEip1193()
  if (!eip) throw new Error('No wallet provider found')
  return new ethers.BrowserProvider(eip)
}

export async function ensureBaseChain(provider) {
  const eip = provider?.provider
  if (!eip) throw new Error('No wallet provider found')

  const net = await provider.getNetwork().catch(() => null)
  if (net?.chainId === BASE_CHAIN_ID) return true

  try {
    await eip.request?.({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID_HEX }] })
    return true
  } catch (e) {
    if (e?.code === 4902) {
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
    }
    throw e
  }
}

/** One-call connect used by your UI “Connect Wallet” button */
export async function connectWallet() {
  const provider = await getBrowserProvider()
  await provider.send('eth_requestAccounts', [])
  await ensureBaseChain(provider)
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  return { provider, signer, address }
}
