// lib/wagmi.js
import React from 'react'
import { createConfig, WagmiConfig, configureChains } from 'wagmi'
import { base } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'

// v1 connectors
import { InjectedConnector } from 'wagmi/connectors/injected'
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet'

// Farcaster connector (guarded for SSR)
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

// --- Chains & Providers ---
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [base],
  [
    // Prefer your own RPC if set
    jsonRpcProvider({
      rpc: (chain) =>
        chain.id === base.id
          ? { http: BASE_RPC }
          : null,
    }),
    // Fallback public
    publicProvider(),
  ]
)

// --- Connectors (browser guarded for Farcaster) ---
function getConnectors() {
  const connectors = []

  // Farcaster Mini App connector – only add in the browser to avoid SSR crashes
  if (typeof window !== 'undefined') {
    try {
      // If their connector needs options, pass them here
      // e.g., farcasterMiniApp({ appName: 'MadFill' })
      connectors.push(farcasterMiniApp())
    } catch {
      // no-op if lib throws outside the mini app
    }
  }

  // Standard fallbacks so the dapp works outside Farcaster too
  connectors.push(
    new InjectedConnector({
      chains,
      options: { shimDisconnect: true },
    })
  )

  if (WC_PROJECT_ID) {
    connectors.push(
      new WalletConnectConnector({
        chains,
        options: {
          projectId: WC_PROJECT_ID,
          showQrModal: true,
        },
      })
    )
  }

  connectors.push(
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName: 'MadFill',
      },
    })
  )

  return connectors
}

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: getConnectors(),
  publicClient,
  webSocketPublicClient,
})

export function WagmiProvider({ children }) {
  return <WagmiConfig config={wagmiConfig}>{children}</WagmiConfig>
}
