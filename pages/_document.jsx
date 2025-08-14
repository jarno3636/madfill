// pages/_document.jsx
import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  // Normalize styles to avoid `.length` errors in some environments
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    const stylesArray = Array.isArray(initialProps.styles)
      ? initialProps.styles
      : [initialProps.styles].filter(Boolean)

    return {
      ...initialProps,
      styles: stylesArray,
    }
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Keep head minimal; add preconnects only (SSR-safe) */}
          <meta name="theme-color" content="#0b0f19" />
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
