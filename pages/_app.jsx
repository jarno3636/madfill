// /pages/_app.jsx
import { useEffect } from 'react'
import Script from 'next/script'
import ErrorBoundary from '@/components/ErrorBoundary'
import { performanceMonitor } from '@/lib/performance'
import { GA_TRACKING_ID, pageview } from '@/lib/analytics'
import { useRouter } from 'next/router'
import { ToastProvider } from '@/components/Toast'
import { WalletProvider } from '@/components/WalletProvider'   // ✅ add
import '@/styles/globals.css'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const GA_ID_SAFE =
    typeof GA_TRACKING_ID === 'string'
      ? GA_TRACKING_ID.replace(/[^A-Za-z0-9_-]/g, '')
      : ''

  useEffect(() => {
    const handleRouteChange = (url) => {
      try { if (GA_ID_SAFE && typeof window !== 'undefined' && window.gtag) pageview(url) } catch {}
    }
    router.events?.on('routeChangeComplete', handleRouteChange)
    return () => router.events?.off('routeChangeComplete', handleRouteChange)
  }, [router, GA_ID_SAFE])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onError = (e) => {
      try { window.gtag?.('event', 'exception', { description: e?.error ? String(e.error) : String(e?.message), fatal: false }) } catch {}
    }
    const onRejection = (e) => {
      try { window.gtag?.('event', 'exception', { description: 'Unhandled Promise Rejection: ' + String(e?.reason), fatal: false }) } catch {}
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => () => { try { performanceMonitor.cleanup?.() } catch {} }, [])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <WalletProvider>
          {GA_ID_SAFE ? (
            <>
              <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID_SAFE}`} />
              <Script id="gtag-init" strategy="afterInteractive" dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){ dataLayer.push(arguments); }
                  gtag('js', new Date());
                  gtag('config', '${GA_ID_SAFE}', { page_path: window.location.pathname });
                `,
              }} />
            </>
          ) : null}
          <Script strategy="afterInteractive" src="/_vercel/insights/script.js" />
          <Component {...pageProps} />
        </WalletProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
