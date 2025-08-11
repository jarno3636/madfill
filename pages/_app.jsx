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
        {/* --- Default SEO fallbacks (overridden by per-page <SEO />) --- */}
        <title>{DEFAULT_SEO.title}</title>
        <meta name="description" content={DEFAULT_SEO.description} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={DEFAULT_SEO.title} />
        <meta property="og:description" content={DEFAULT_SEO.description} />
        {/* Use your dynamic OG when available; fallback to a static */}
        <meta property="og:image" content={DEFAULT_SEO.image || '/og/default.png'} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={DEFAULT_SEO.title} />
        <meta name="twitter:description" content={DEFAULT_SEO.description} />
        <meta name="twitter:image" content={DEFAULT_SEO.image || '/og/default.png'} />

        {/* PWA / icons (no transparent backgrounds) */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" sizes="512x512" href="/android-chrome-512x512.png" />
        {/* If you add a webmanifest later, uncomment this: */}
        {/* <link rel="manifest" href="/site.webmanifest" /> */}
        <meta name="theme-color" content="#0b1220" />

        {/* We do NOT set Farcaster frame tags globally to avoid duplicates.
            Each page that needs a frame adds its own <meta property="fc:*" ... /> */}
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
