// pages/_document.jsx
import Document, { Html, Head, Main, NextScript } from 'next/document'
import React from 'react'

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    // Grab Next's default props but make absolutely sure `styles` is an array.
    let initialProps = await Document.getInitialProps(ctx)
    const safeStyles = React.Children.toArray(initialProps?.styles || [])
    return { ...initialProps, styles: safeStyles }
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Keep this lean and static */}
          <link rel="icon" href="/favicon.ico" />
          <meta name="theme-color" content="#1e293b" />
          <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
          <meta httpEquiv="Referrer-Policy" content="origin-when-cross-origin" />
          {/* DO NOT put viewport here (Next injects it). No scripts here either. */}
        </Head>
        <body className="antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
