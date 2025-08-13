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

  // Track page views (guard in case events is undefined during hydration)
  useEffect(() => {
    const handleRouteChange = (url) => {
      try { pageview(url) } catch {}
    }
    router.events?.on('routeChangeComplete', handleRouteChange)
    return () => router.events?.off('routeChangeComplete', handleRouteChange)
  }, [router.events])

  // Runtime error + unhandled rejection tracking (what we previously had in _document)
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
   
