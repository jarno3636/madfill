// lib/getProvider.js
import { ethers } from 'ethers'

export function getBrowserEip1193() {
  if (typeof window === 'undefined') return null

  // Coinbase embedded provider inside Warpcast
  if (window.coinbaseWallet && window.coinbaseWallet.provider) {
    return window.coinbaseWallet.provider
  }

  // Standard EIP-1193
  if (window.ethereum) return window.ethereum

  // Rare case
  if (navigator && navigator.ethereum) return navigator.ethereum

  return null
}

export async function getEthersSigner() {
  const eip1193 = getBrowserEip1193()
  if (!eip1193) {
    throw new Error('No EIP-1193 provider found')
  }

  // Trigger wallet connection on user click
  if (eip1193.request) {
    await eip1193.request({ method: 'eth_requestAccounts' })
  }

  const browserProvider = new ethers.BrowserProvider(eip1193)
  return browserProvider.getSigner()
}
