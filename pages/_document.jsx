import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
        <link rel="preconnect" href="https://mainnet.base.org" />
        
        {/* DNS prefetch for analytics and external services */}
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />
        <link rel="dns-prefetch" href="//vercel.com" />
        
        {/* Favicon and icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Meta tags for PWA */}
        <meta name="theme-color" content="#1e293b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="" />
        
        {/* Security headers via meta tags */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="ALLOWALL" />
        <meta httpEquiv="Referrer-Policy" content="origin-when-cross-origin" />
        
        {/* Performance optimizations */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="format-detection" content="telephone=no" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
        
        {/* Error tracking for production */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (window.gtag) {
                  gtag('event', 'exception', {
                    description: e.error ? e.error.toString() : e.message,
                    fatal: false
                  });
                }
              });
              
              window.addEventListener('unhandledrejection', function(e) {
                if (window.gtag) {
                  gtag('event', 'exception', {
                    description: 'Unhandled Promise Rejection: ' + e.reason,
                    fatal: false
                  });
                }
              });
            `
          }}
        />
      </body>
    </Html>
  )
}