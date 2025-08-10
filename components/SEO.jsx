// components/SEO.jsx
import Head from 'next/head'
import { absoluteUrl, canonicalUrl, DEFAULT_SEO } from '@/lib/seo'

/**
 * Farcaster usage:
 * <SEO
 *   title="Active Rounds — MadFill"
 *   description="Browse live rounds…"
 *   path="/active"
 *   image={buildOgUrl({ screen: 'active' })}
 *   fc={{
 *     enabled: true,
 *     image: buildOgUrl({ screen: 'active' }),
 *     buttons: [
 *       { label: 'View Rounds', action: 'link', target: absoluteUrl('/active') },
 *       // up to 4 buttons total
 *     ],
 *     postUrl: absoluteUrl('/api/frame') // optional, only if you handle post callbacks
 *   }}
 * />
 */
export default function SEO({
  title = DEFAULT_SEO.title,
  description = DEFAULT_SEO.description,
  url,          // absolute URL; or use `path`
  image,        // absolute OG image (or we’ll fallback)
  path,         // relative path; we resolve to absolute
  noindex = false,
  siteName = 'MadFill',
  twitterSite = '@',   // set if you have one
  twitterCreator = '',
  themeColor = '#0f172a',
  // Farcaster Frame options (all optional)
  fc = {
    enabled: false,
    image: null,          // image for the frame
    buttons: [],          // [{label, action:'link'|'post'|'post_redirect', target?}]
    postUrl: null,        // for post/post_redirect callbacks
  },
}) {
  const pageUrl = url ? absoluteUrl(url) : canonicalUrl(path || '/')
  const ogImage = image ? absoluteUrl(image) : DEFAULT_SEO.image

  // Build Farcaster meta if asked
  const fcEnabled = Boolean(fc?.enabled)
  const fcImage = absoluteUrl(fc?.image || ogImage)
  const fcButtons = Array.isArray(fc?.buttons) ? fc.buttons.slice(0, 4) : []
  const fcPostUrl = fc?.postUrl ? absoluteUrl(fc.postUrl) : null

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
      <meta property="og:image:alt" content={title} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      {twitterSite ? <meta name="twitter:site" content={twitterSite} /> : null}
      {twitterCreator ? <meta name="twitter:creator" content={twitterCreator} /> : null}
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Farcaster Frame (optional) */}
      {fcEnabled && (
        <>
          <meta name="fc:frame" content="vNext" />
          <meta name="fc:frame:image" content={fcImage} />
          {/* Optional button list (1..4) */}
          {fcButtons.map((b, i) => {
            const idx = i + 1
            const action = b.action || 'link'
            const target = b.target ? absoluteUrl(b.target) : undefined
            return (
              <React.Fragment key={idx}>
                <meta name={`fc:frame:button:${idx}`} content={b.label || `Button ${idx}`} />
                {action && <meta name={`fc:frame:button:${idx}:action`} content={action} />}
                {target && <meta name={`fc:frame:button:${idx}:target`} content={target} />}
              </React.Fragment>
            )
          })}
          {/* post url (for post / post_redirect) */}
          {fcPostUrl && <meta name="fc:frame:post_url" content={fcPostUrl} />}
        </>
      )}
    </Head>
  )
}
