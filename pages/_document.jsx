// pages/_document.jsx
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Preconnects */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
        <link rel="preconnect" href="https://mainnet.base.org" />

        {/* DNS Prefetch (keep minimal) */}
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />

        {/* Icons / PWA */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Theme / PWA meta */}
        <meta name="theme-color" content="#1e293b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Preload critical font (ensure this file exists) */}
        <link
          rel="preload"
          href="/fonts/inter.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        {/* Security (meta variants are mostly no-ops; real headers set in next.config.js) */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Referrer-Policy" content="origin-when-cross-origin" />

        {/* (Optional) Move viewport into page-level <Head> if you want to follow Next’s guidance */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="format-detection" content="telephone=no" />
      </Head>

      <body className="antialiased">
        <Main />
        <NextScript />

        {/* Lightweight error tracking safe for SSR hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (window.gtag) {
                  gtag('event', 'exception', {
                    description: e?.error ? String(e.error) : String(e.message),
                    fatal: false
                  });
                }
              });
              window.addEventListener('unhandledrejection', function(e) {
                if (window.gtag) {
                  gtag('event', 'exception', {
                    description: 'Unhandled Promise Rejection: ' + String(e?.reason ?? ''),
                    fatal: false
                  });
                }
              });
            `,
          }}
        />
      </body>
    </Html>
  )
}
