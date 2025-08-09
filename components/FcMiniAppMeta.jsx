'use client'
import Head from 'next/head'

/**
 * Props:
 * - imageUrl: 1200×800 (3:2) looks great
 * - buttonTitle: CTA label
 * - name: app name
 * - splashImageUrl: small square icon (e.g., /og/cover.png)
 * - splashBackgroundColor: hex
 * - url: optional; if omitted, Warpcast uses the current page URL
 */
export default function FcMiniAppMeta({
  imageUrl,
  buttonTitle = 'Open MadFill',
  name = 'MadFill',
  splashImageUrl = '/og/cover.PNG',
  splashBackgroundColor = '#3b1a9a',
  url,
}) {
  const frame = {
    version: '1',
    imageUrl,
    button: {
      title: buttonTitle,
      action: {
        type: 'launch_frame',
        name,
        url,
        splashImageUrl,
        splashBackgroundColor,
      },
    },
  }
  return (
    <Head>
      <meta name="fc:miniapp" content={JSON.stringify(frame)} />
    </Head>
  )
}
