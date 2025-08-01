// lib/wagmi.ts
import { createConfig, WagmiConfig, configureChains } from 'wagmi'
import { viemPublicProvider } from 'wagmi/providers/viem'
import { InjectedConnector } from 'wagmi/connectors/injected'

// Define Base network
export const baseChain = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: { name: 'Base', symbol: 'BASE', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://basescan.org' } },
  testnet: false,
}

const { publicClient, webSocketPublicClient } = configureChains(
  [baseChain],
  [viemPublicProvider()]
)

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [new InjectedConnector({ chains: [baseChain] })],
  publicClient,
  webSocketPublicClient,
})

export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return <WagmiConfig config={wagmiConfig}>{children}</WagmiConfig>
}
