import { useEffect } from 'react'
import Script from 'next/script'
import ErrorBoundary from '../components/ErrorBoundary'
import { performanceMonitor } from '../lib/performance'
import { GA_TRACKING_ID, pageview } from '../lib/analytics'
import { useRouter } from 'next/router'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    // Track page views
    const handleRouteChange = (url) => {
      pageview(url)
    }

    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router.events])

  useEffect(() => {
    // Clean up performance monitor on unmount
    return () => {
      performanceMonitor.cleanup()
    }
  }, [])

  return (
    <ErrorBoundary>
      {/* Google Analytics */}
      {GA_TRACKING_ID && (
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
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_TRACKING_ID}', {
                  page_path: window.location.pathname,
                });
              `,
            }}
          />
        </>
      )}

      {/* Vercel Analytics */}
      <Script
        strategy="afterInteractive"
        src="/_vercel/insights/script.js"
      />

      <Component {...pageProps} />
    </ErrorBoundary>
  )
}