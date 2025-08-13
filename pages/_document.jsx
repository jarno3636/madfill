// pages/_document.jsx
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Keep this lean and static */}
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#1e293b" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Referrer-Policy" content="origin-when-cross-origin" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
