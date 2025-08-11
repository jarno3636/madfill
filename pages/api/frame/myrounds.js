// pages/api/frame/myrounds.js
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'
const OG = `${SITE}/api/og?screen=myrounds&title=My%20Rounds`

export default async function handler(req, res) {
  const pageUrl = `${SITE}/myrounds`
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="MadFill — My Rounds" />
    <meta property="og:image" content="${OG}" />

    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${OG}" />

    <meta name="fc:frame:button:1" content="📜 Open My Rounds" />
    <meta name="fc:frame:button:1:action" content="link" />
    <meta name="fc:frame:button:1:target" content="${pageUrl}" />
  </head><body></body></html>`
  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(html)
}
