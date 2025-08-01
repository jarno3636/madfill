// pages/_app.jsx
import '@/styles/globals.css'
import { WagmiConfig } from 'wagmi'
import { createConfig, configureChains } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'
import { base } from 'wagmi/chains'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

const { chains, publicClient } = configureChains([base], [publicProvider()])

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [farcasterMiniApp()],
  publicClient,
})

export default function App({ Component, pageProps }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <Component {...pageProps} />
    </WagmiConfig>
  )
}
