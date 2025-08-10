// components/SEO.jsx
import Head from 'next/head'
import { absoluteUrl, canonicalUrl, DEFAULT_SEO } from '@/lib/seo'

export default function SEO({
  title = DEFAULT_SEO.title,
  description = DEFAULT_SEO.description,
  url,          // preferred absolute URL for this page
  image,        // absolute OG image URL (or we’ll fallback)
  path,         // if you’d rather pass a path, we’ll resolve it
  noindex = false,
  siteName = 'MadFill',
  twitterSite = '@',  // set if you have a site account
  twitterCreator = '', // set if you want a default creator
  themeColor = '#0f172a', // slate-900-ish
}) {
  const pageUrl = url ? absoluteUrl(url) : canonicalUrl(path || '/')
  const ogImage = image ? absoluteUrl(image) : DEFAULT_SEO.image

  return (
    <Head>
      {/* Primary */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Canonical */}
      <link rel="canonical" href={pageUrl} />

      {/* Theme */}
      <meta name="theme-color" content={themeColor} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      {twitterSite && <meta name="twitter:site" content={twitterSite} />}
      {twitterCreator && <meta name="twitter:creator" content={twitterCreator} />}
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Head>
  )
}
