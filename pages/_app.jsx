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

  // Sanitize GA id for inline script safety (no quotes/semicolons injected)
  const GA_ID_SAFE =
    typeof GA_TRACKING_ID === 'string'
      ? GA_TRACKING_ID.replace(/[^A-Za-z0-9_-]/g, '')
      : ''

  // Track page views on route changes (initial is handled by gtag config below)
  useEffect(() => {
    const handleRouteChange = (url) => {
      try {
        if (GA_ID_SAFE && typeof window !== 'undefined' && window.gtag) {
          pageview(url)
        }
      } catch {
        // no-op
      }
    }
    router.events?.on('routeChangeComplete', handleRouteChange)
    return () => router.events?.off('routeChangeComplete', handleRouteChange)
  }, [router.events, GA_ID_SAFE])

  // Client-side error tracking to GA
  useEffect(() => {
    if (typeof window === 'undefined') return

    const onError = (e) => {
      try {
        if (window.gtag) {
          window.gtag('event', 'exception', {
            description: e?.error ? String(e.error) : String(e?.message),
            fatal: false,
          })
        }
      } catch {}
    }

    const onRejection = (e) => {
      try {
        if (window.gtag) {
          window.gtag('event', 'exception', {
            description: 'Unhandled Promise Rejection: ' + String(e?.reason),
            fatal: false,
          })
        }
      } catch {}
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  // Cleanup performance observers on unmount (defensive)
  useEffect(() => {
    return () => {
      try {
        performanceMonitor?.cleanup?.()
      } catch {}
    }
  }, [])

  return (
    <ErrorBoundary>
      {GA_ID_SAFE ? (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID_SAFE}`}
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){ dataLayer.push(arguments); }
                gtag('js', new Date());
                gtag('config', '${GA_ID_SAFE}', { page_path: window.location.pathname });
              `,
            }}
          />
        </>
      ) : null}

      {/* Vercel Web Analytics (safe to include unconditionally) */}
      <Script strategy="afterInteractive" src="/_vercel/insights/script.js" />

      <Component {...pageProps} />
    </ErrorBoundary>
  )
}
