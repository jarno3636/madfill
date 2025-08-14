// pages/_document.js
import Document, { Html, Head, Main, NextScript } from 'next/document'

/**
 * Minimal, robust Document for Next.js (Pages Router).
 * - Normalizes `styles` so downstream bundler/runtime never sees `undefined`.
 * - Avoids custom chunk reductions that have caused build-time crashes.
 * - No browser globals; SSR-only.
 */
export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    // Normalize styles to an array to prevent `.length`/map errors.
    const normalizedStyles = Array.isArray(initialProps.styles)
      ? initialProps.styles
      : initialProps.styles
        ? [initialProps.styles]
        : []

    return {
      ...initialProps,
      styles: normalizedStyles,
    }
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Keep head minimal; SEO/OG is handled per-page */}
          <meta name="theme-color" content="#0f172a" />
        </Head>
        <body className="antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
