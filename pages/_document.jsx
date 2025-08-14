// pages/_document.jsx
import Document, { Html, Head, Main, NextScript } from 'next/document'

/**
 * Canonical custom Document.
 * Do NOT override getInitialProps — let Next inject styles.
 */
class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta name="theme-color" content="#0b0f19" />
          {/* preconnects are safe/minimal */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
