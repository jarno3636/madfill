// components/FcMiniAppMeta.jsx
'use client'

import Head from 'next/head'

/**
 * Farcaster Mini App meta. All URLs must be absolute (https).
 * props:
 * - image (required): absolute URL to 1200x630 image
 * - postUrl (required): absolute URL to this page (or an action endpoint)
 * - appName, appUrl, appIcon, appTheme (optional)
 * - buttons (optional): array of up to 4 strings (labels)
 */
export default function FcMiniAppMeta({
  image,
  postUrl,
  appName = 'MadFill',
  appUrl,
  appIcon = 'https://madfill.vercel.app/og/cover.PNG',
  appTheme = '#1e1b4b',
  buttons = ['Open'],
}) {
  // Ensure absolute https (Warpcast requirement)
  const abs = (u) => (u?.startsWith('http') ? u : `https://madfill.vercel.app${u || ''}`)
  const img = abs(image)
  const post = abs(postUrl)
  const app = abs(appUrl || postUrl)

  return (
    <Head>
      {/* Mini App (Frame) basics */}
      <meta name="fc:frame" content="vNext" />
      <meta name="fc:frame:image" content={img} />
      <meta name="fc:frame:post_url" content={post} />
      {buttons?.[0] && <meta name="fc:frame:button:1" content={buttons[0]} />}
      {buttons?.[1] && <meta name="fc:frame:button:2" content={buttons[1]} />}
      {buttons?.[2] && <meta name="fc:frame:button:3" content={buttons[2]} />}
      {buttons?.[3] && <meta name="fc:frame:button:4" content={buttons[3]} />}

      {/* Optional app card polish (shows while loading) */}
      <meta name="fc:app:name" content={appName} />
      <meta name="fc:app:url" content={app} />
      <meta name="fc:app:icon" content={abs(appIcon)} />
      <meta name="fc:app:theme" content={appTheme} />
    </Head>
  )
}
