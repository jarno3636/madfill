import Head from 'next/head'

export default function SEO({ 
  title = 'MadFill', 
  description = 'Fill the blank, win the pot on Base', 
  url = '',
  image = '',
  type = 'website'
}) {
  const siteTitle = 'MadFill'
  const fullTitle = title === siteTitle ? title : `${title} | ${siteTitle}`
  
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {url && <meta property="og:url" content={url} />}
      {image && <meta property="og:image" content={image} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
      
      {/* Farcaster Frame */}
      <meta property="fc:frame" content="vNext" />
      <meta property="fc:frame:image" content={image || '/og/cover.png'} />
      <meta property="fc:frame:button:1" content="Play MadFill" />
      <meta property="fc:frame:button:1:action" content="link" />
      <meta property="fc:frame:button:1:target" content={url || 'https://madfill.vercel.app'} />
    </Head>
  )
}