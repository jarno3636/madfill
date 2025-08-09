// components/SEO.jsx
import Head from 'next/head'

export default function SEO({
  title = 'MadFill',
  description = 'Fill the blank on Base. Create rounds, vote, and win the pool.',
  url = 'https://madfill.vercel.app',
  image = 'https://madfill.vercel.app/api/og',
}) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Farcaster-friendly hints (benign if ignored) */}
      <meta name="fc:frame" content="vNext" />
      <meta name="fc:frame:image" content={image} />
      <meta name="fc:frame:post_url" content={`${url}/api/frame`} />
      <meta name="fc:frame:button:1" content="Open MadFill" />
    </Head>
  )
}
