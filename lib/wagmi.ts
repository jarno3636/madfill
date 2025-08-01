import { createClient, configureChains, WagmiConfig } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'
import { InjectedConnector } from 'wagmi/connectors/injected'

export const baseChain = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: { name: 'Base', symbol: 'BASE', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://basescan.org' } },
  testnet: false,
}

const { chains, provider, webSocketProvider } = configureChains(
  [baseChain],
  [publicProvider()]
)

export const wagmiClient = createClient({
  autoConnect: true,
  connectors: [new InjectedConnector({ chains })],
  provider,
  webSocketProvider,
})

export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return <WagmiConfig client={wagmiClient}>{children}</WagmiConfig>
}
