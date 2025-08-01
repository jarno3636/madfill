// lib/wagmi.js
import { createConfig, WagmiConfig } from 'wagmi'
import { InjectedConnector } from '@wagmi/connectors'
import { createPublicClient, http } from 'viem'

export const baseChain = { /* same as before */ }

export const publicClient = createPublicClient({
  chain: baseChain,
  transport: http(),
})

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [new InjectedConnector({ chains: [baseChain] })],
  publicClient,
})

export function WagmiProvider({ children }) {
  return <WagmiConfig config={wagmiConfig}>{children}</WagmiConfig>
}
