// pages/_app.jsx
import '../styles/globals.css'
import { WagmiProvider } from '../lib/wagmi'

export default function MyApp({ Component, pageProps }) {
  return (
    <WagmiProvider>
      <Component {...pageProps} />
    </WagmiProvider>
  )
}
