// pages/_document.jsx
import Document, { Html, Head, Main, NextScript } from 'next/document'
import React from 'react'

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const originalRenderPage = ctx.renderPage

    // You can enhance the app here if needed
    ctx.renderPage = () =>
      originalRenderPage({
        enhanceApp: (App) => (props) => <App {...props} />,
      })

    const initialProps = await Document.getInitialProps(ctx)

    // ✅ Normalize styles so Next's reducers never see undefined
    const normalizedStyles = [
      ...(React.Children.toArray(initialProps.styles) || []),
    ]

    return {
      ...initialProps,
      styles: normalizedStyles,
    }
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Preconnect / DNS Prefetch */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
          <link rel="preconnect" href="https://mainnet.base.org" />
          <link rel="dns-prefetch" href="//www.googletagmanager.com" />
          <link rel="dns-prefetch" href="//vercel.com" />

          {/* Icons */}
          <link rel="icon" href="/favicon.ico" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />

          {/* PWA / meta */}
          <meta name="theme-color" content="#1e293b" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

          {/* Preload a local font (keep crossorigin undefined or 'anonymous') */}
          <link
            rel="preload"
            href="/fonts/inter.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />

          {/* Security meta (these mirror headers; fine to keep) */}
          <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
          <meta httpEquiv="X-Frame-Options" content="ALLOWALL" />
          <meta httpEquiv="Referrer-Policy" content="origin-when-cross-origin" />

          {/* NOTE: Leave out viewport here; Next injects it automatically */}
        </Head>
        <body className="antialiased">
          <Main />
          <NextScript />

          {/* Lightweight runtime error tracking (safe on client) */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function () {
                  if (typeof window === 'undefined') return;
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
                        description: 'Unhandled Promise Rejection: ' + String(e.reason),
                        fatal: false
                      });
                    }
                  });
                })();
              `,
            }}
          />
        </body>
      </Html>
    )
  }
}
