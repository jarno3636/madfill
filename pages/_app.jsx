// pages/_app.jsx
import '../styles/globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import { WagmiProvider } from '@/lib/wagmi'

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <WagmiProvider>
        <Component {...pageProps} />
      </WagmiProvider>
    </ErrorBoundary>
  )
}
