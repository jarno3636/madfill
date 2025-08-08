// lib/wagmi.js
import { WagmiConfig, createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import detectEthereumProvider from '@metamask/detect-provider'
import CoinbaseWalletSDK from '@coinbase/wallet-sdk'

/** Minimal custom connector: Coinbase Wallet SDK */
const coinbaseConnector = () => ({
  id: 'coinbase',
  name: 'Coinbase Wallet',
  type: 'injected',
  createConnector: () => {
    const sdk = new CoinbaseWalletSDK({ appName: 'MadFill' })
    const ethereum = sdk.makeWeb3Provider('https://mainnet.base.org', 8453)
    return {
      uid: 'coinbase',
      name: 'Coinbase Wallet',
      type: 'injected',
      connect: async () => {
        await ethereum.request({ method: 'eth_requestAccounts' })
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' })
        return { chainId: parseInt(chainIdHex, 16) }
      },
      disconnect: async () => {},
      getProvider: async () => ethereum,
    }
  },
})

/** Minimal custom connector: MetaMask (detects provider) */
const metamaskConnector = () => ({
  id: 'metamask',
  name: 'MetaMask',
  type: 'injected',
  createConnector: () => {
    return {
      uid: 'metamask',
      name: 'MetaMask',
      type: 'injected',
      connect: async () => {
        const provider = await detectEthereumProvider()
        if (!provider) throw new Error('MetaMask not found')
        await provider.request({ method: 'eth_requestAccounts' })
        const chainIdHex = await provider.request({ method: 'eth_chainId' })
        return { chainId: parseInt(chainIdHex, 16) }
      },
      disconnect: async () => {},
      getProvider: async () => detectEthereumProvider(),
    }
  },
})

export const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org') },
  connectors: [
    farcasterMiniApp(),
    coinbaseConnector(),
    metamaskConnector(),
  ],
  multiInjectedProviderDiscovery: true,
  ssr: true,
})

export function WagmiProvider({ children }) {
  return <WagmiConfig config={wagmiConfig}>{children}</WagmiConfig>
}
