// pages/_app.jsx
'use client'

import '@/styles/globals.css'
import Head from 'next/head'
import Layout from '@/components/Layout'
import { DEFAULT_SEO } from '@/lib/seo'

// If you have wallet/provider setup:
// import { WagmiConfig } from 'wagmi'
// import { config } from '@/lib/wagmi'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>{DEFAULT_SEO.title}</title>
        <meta name="description" content={DEFAULT_SEO.description} />
        <meta property="og:title" content={DEFAULT_SEO.title} />
        <meta property="og:description" content={DEFAULT_SEO.description} />
        <meta property="og:image" content={DEFAULT_SEO.image} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={DEFAULT_SEO.title} />
        <meta name="twitter:description" content={DEFAULT_SEO.description} />
        <meta name="twitter:image" content={DEFAULT_SEO.image} />
      </Head>

      {/* Uncomment if you use wagmi */}
      {/* <WagmiConfig config={config}> */}
        <Layout>
          <Component {...pageProps} />
        </Layout>
      {/* </WagmiConfig> */}
    </>
  )
}
