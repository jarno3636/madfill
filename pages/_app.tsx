// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { WagmiProvider } from '../lib/wagmi'

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider>
      <Component {...pageProps} />
    </WagmiProvider>
  )
}
