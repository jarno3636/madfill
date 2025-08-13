// components/SEO.jsx
import Head from 'next/head'
import { absoluteUrl } from '@/lib/seo'

/**
 * SEO — per-page meta tags
 * - All URLs normalized to absolute via absoluteUrl()
 * - Safe defaults; avoids emitting empty tags
 * - SSR-safe: no window/document access
 */
export default function SEO({
  title = 'MadFill',
  description = 'Fill the blank, win the pot on Base.',
  /** Prefer `path` and `imagePath`; `url` and `image` still accepted for backward compat */
  path = '',
  url, // legacy alias for canonical
  imagePath = '/og/cover.png',
  image, // legacy alias for imagePath
  type = 'website',
  locale = 'en_US',
  siteName = 'MadFill',
  twitterCard = 'summary_large_image',
  noindex = false,
}) {
  // Clamp description to ~200 chars to avoid social truncation weirdness
  const safeDesc =
    typeof description === 'string'
      ? description.slice(0, 200)
      : 'Fill the blank, win the pot on Base.'

  // Canonical URL
  const canonicalUrl = absoluteUrl((url || path || '').toString())

  // Image URL (prefer explicit image > imagePath > default)
  const imageUrl = absoluteUrl((image || imagePath || '/og/cover.png').toString())

  // Title format: "<Page> | MadFill" unless already the site name
  const fullTitle = title && title !== siteName ? `${title} | ${siteName}` : siteName

  return (
    <Head>
      {/* Basic */}
      <title>{fullTitle}</title>
      <meta name="description" content={safeDesc} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Canonical */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={locale} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={safeDesc} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      {imageUrl && <meta property="og:image" content={imageUrl} />}

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={safeDesc} />
      {imageUrl && <meta name="twitter:image" content={imageUrl} />}

      {/* Farcaster Frame (static link to app; per-page frames can override on specific routes) */}
      <meta property="fc:frame" content="vNext" />
      {imageUrl && <meta property="fc:frame:image" content={imageUrl} />}
      <meta property="fc:frame:button:1" content="Play MadFill" />
      <meta property="fc:frame:button:1:action" content="link" />
      <meta
        property="fc:frame:button:1:target"
        content={canonicalUrl || absoluteUrl('/')}
      />
    </Head>
  )
}
