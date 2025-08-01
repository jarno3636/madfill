// lib/wagmi.ts
import { createConfig, WagmiConfig } from 'wagmi'
-import { InjectedConnector } from 'wagmi/connectors/injected'
+import { InjectedConnector } from '@wagmi/connectors'

import { createPublicClient, http } from 'viem'

// Base mainnet definition
export const baseChain = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: { name: 'Base', symbol: 'BASE', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://basescan.org' } },
  testnet: false,
}

// Create a Viem public client for Base
export const publicClient = createPublicClient({
  chain: baseChain,
  transport: http(),
})

// Build the Wagmi config
export const wagmiConfig = createConfig({
  autoConnect: true,
-  connectors: [new InjectedConnector({ chains: [baseChain] })],
+  connectors: [new InjectedConnector({ chains: [baseChain] })],
  publicClient,
})

// Wrap your app
export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return <WagmiConfig config={wagmiConfig}>{children}</WagmiConfig>
}
