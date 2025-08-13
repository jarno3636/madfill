// pages/_document.jsx
import Document, { Html, Head, Main, NextScript } from 'next/document'
import React from 'react'

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    // Ensure styles is an array to avoid edge cases with styled-jsx/Emotion.
    const initialProps = await Document.getInitialProps(ctx)
    const safeStyles = React.Children.toArray(initialProps?.styles || [])
    return { ...initialProps, styles: safeStyles }
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Keep this lean and static. No scripts here. */}
          <link rel="icon" href="/favicon.ico" />
          <meta name="theme-color" content="#1e293b" />
          {/* Use the standard meta for referrer policy */}
          <meta name="referrer" content="origin-when-cross-origin" />
          {/* Security headers like X-Content-Type-Options must be sent via HTTP headers, not meta tags. */}
        </Head>
        {/* Next injects the viewport meta automatically. */}
        <body className="antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
