// pages/_app.jsx
import { useEffect } from 'react'
import Script from 'next/script'
import ErrorBoundary from '@/components/ErrorBoundary'
import { performanceMonitor } from '@/lib/performance'
import { GA_TRACKING_ID, pageview } from '@/lib/analytics'
import { useRouter } from 'next/router'
import '@/styles/globals.css'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  // Track page views
  useEffect(() => {
    const handleRouteChange = (url) => {
      try { pageview(url) } catch {}
    }
    router.events?.on('routeChangeComplete', handleRouteChange)
    return () => router.events?.off('routeChangeComplete', handleRouteChange)
  }, [router.events])

  // Client-side error tracking
  useEffect(() => {
    if (typeof window === 'undefined') return

    const onError = (e) => {
      if (window.gtag) {
        window.gtag('event', 'exception', {
          description: e?.error ? String(e.error) : String(e?.message),
          fatal: false,
        })
      }
    }

    const onRejection = (e) => {
      if (window.gtag) {
        window.gtag('event', 'exception', {
          description: 'Unhandled Promise Rejection: ' + String(e?.reason),
          fatal: false,
        })
      }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      try { performanceMonitor.cleanup?.() } catch {}
    }
  }, [])

  return (
    <ErrorBoundary>
      {GA_TRACKING_ID ? (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){ dataLayer.push(arguments); }
                gtag('js', new Date());
                gtag('config', '${GA_TRACKING_ID}', { page_path: window.location.pathname });
              `,
            }}
          />
        </>
      ) : null}

      <Script strategy="afterInteractive" src="/_vercel/insights/script.js" />
      <Component {...pageProps} />
    </ErrorBoundary>
  )
}
