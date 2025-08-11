// pages/api/frame/myo.js
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'
const OG = `${SITE}/api/og?screen=myo&title=Make%20Your%20Own`

export default async function handler(req, res) {
  const pageUrl = `${SITE}/myo`
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="MadFill — Make Your Own" />
    <meta property="og:image" content="${OG}" />

    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${OG}" />

    <meta name="fc:frame:button:1" content="🎨 Start Building" />
    <meta name="fc:frame:button:1:action" content="link" />
    <meta name="fc:frame:button:1:target" content="${pageUrl}" />
  </head><body></body></html>`
  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(html)
}
