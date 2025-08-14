// pages/_document.jsx
import Document, { Html, Head, Main, NextScript } from 'next/document'

/**
 * Custom Document for Pages Router.
 * - Keeps Next.js defaults (no custom logic beyond getInitialProps passthrough).
 * - Safe for SSR and Vercel static optimization steps.
 */
class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Keep <Head> lean; global meta is handled in pages/components */}
          {/* Preload fonts or add favicon links here if needed */}
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
