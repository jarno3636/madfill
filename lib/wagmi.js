// lib/wagmi.js
import { createConfig, WagmiConfig, configureChains } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'
import { base } from 'wagmi/chains'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

const { chains, publicClient } = configureChains(
  [base],
  [publicProvider()]
)

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    farcasterMiniApp(),  // <- Farcaster’s own connector
  ],
  publicClient,
})

export function WagmiProvider({ children }) {
  return <WagmiConfig config={wagmiConfig}>{children}</WagmiConfig>
}
