// /lib/wallet.js
import { ethers } from 'ethers'

export const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
export const BASE_CHAIN_ID = 8453n
export const BASE_CHAIN_ID_HEX = '0x2105'

const isWarpcastUA = () =>
  typeof navigator !== 'undefined' && /Warpcast/i.test(navigator.userAgent)

let _miniEip1193 = null

export async function getEip1193() {
  // Prefer Mini App provider when inside Warpcast
  if (isWarpcastUA()) {
    if (_miniEip1193) return _miniEip1193
    try {
      const mod = await import('@farcaster/miniapp-sdk')
      const prov = await mod.sdk.wallet.getEthereumProvider()
      _miniEip1193 = prov
      return prov
    } catch {
      // fall through to injected
    }
  }
  // Fallback: injected wallet (MetaMask / Coinbase, etc.)
  if (typeof window !== 'undefined' && window.ethereum) return window.ethereum
  return null
}

export async function getBrowserProvider() {
  const eip = await getEip1193()
  if (!eip) throw new Error('Wallet provider not found')
  return new ethers.BrowserProvider(eip)
}

export async function ensureAccounts(provider) {
  try {
    // Attempt silent read first
    const signer = await provider.getSigner().catch(() => null)
    const addr = await signer?.getAddress().catch(() => null)
    if (addr) return addr
  } catch {}
  // Request connection (Mini App will show Farcaster connect if needed)
  const eip = await getEip1193()
  await eip?.request?.({ method: 'eth_requestAccounts' })
  const signer = await provider.getSigner()
  return signer.getAddress()
}

export async function getAddressOrNull() {
  try {
    const p = await getBrowserProvider()
    const signer = await p.getSigner().catch(() => null)
    const addr = await signer?.getAddress().catch(() => null)
    return addr || null
  } catch { return null }
}

export async function ensureBaseChain(eipOrProvider) {
  const eip =
    eipOrProvider?.provider?.request ? eipOrProvider.provider :
    eipOrProvider?.request ? eipOrProvider :
    (await getEip1193())

  if (!eip) throw new Error('Wallet provider not found')

  try {
    await eip.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    })
  } catch (e) {
    // 4902 = unknown chain
    if (e?.code === 4902 || /Unrecognized chain/.test(String(e?.message || ''))) {
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
      return
    }
    throw e
  }
}

export function onProviderEvents(cb = {}) {
  getEip1193().then((eip) => {
    if (!eip) return
    const { onAccountsChanged, onChainChanged } = cb
    if (onAccountsChanged) eip.on?.('accountsChanged', onAccountsChanged)
    if (onChainChanged) eip.on?.('chainChanged', onChainChanged)
  })
  return () => {
    const eip = _miniEip1193 || (typeof window !== 'undefined' && window.ethereum)
    if (!eip) return
    eip.removeListener?.('accountsChanged', cb.onAccountsChanged)
    eip.removeListener?.('chainChanged', cb.onChainChanged)
  }
}

export async function autoConnectInMiniApp() {
  if (!isWarpcastUA()) return
  try {
    const prov = await getBrowserProvider()
    await ensureBaseChain(prov)
    await ensureAccounts(prov)
  } catch {
    // ignore — user can still press Connect manually
  }
}

export const readProvider = new ethers.JsonRpcProvider(BASE_RPC)

export function extractError(e) {
  return (
    e?.info?.error?.message ||
    e?.shortMessage ||
    e?.reason ||
    e?.error?.message ||
    e?.data?.message ||
    e?.message ||
    'Transaction failed'
  )
}
