// pages/_document.jsx
import { Html, Head, Main, NextScript } from 'next/document'

/**
 * Minimal custom Document.
 * No getInitialProps override — avoids touching Next's internal `styles` shape.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head>
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
