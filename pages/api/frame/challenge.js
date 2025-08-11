// pages/api/frame/challenge.js
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'
const OG = `${SITE}/api/og?screen=challenge&title=MadFill%20Challenge&subtitle=Beat%20the%20current%20winner`

export default async function handler(req, res) {
  const pageUrl = `${SITE}/challenge`
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="MadFill — Community Challenge" />
    <meta property="og:image" content="${OG}" />

    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${OG}" />

    <meta name="fc:frame:button:1" content="⚔️ Start Challenge" />
    <meta name="fc:frame:button:1:action" content="link" />
    <meta name="fc:frame:button:1:target" content="${pageUrl}" />

    <meta name="fc:frame:button:2" content="🔥 Active Rounds" />
    <meta name="fc:frame:button:2:action" content="link" />
    <meta name="fc:frame:button:2:target" content="${SITE}/active" />

    <meta name="fc:frame:button:3" content="🗳️ Vote Now" />
    <meta name="fc:frame:button:3:action" content="link" />
    <meta name="fc:frame:button:3:target" content="${SITE}/vote" />

    <meta name="fc:frame:button:4" content="🏠 Home" />
    <meta name="fc:frame:button:4:action" content="link" />
    <meta name="fc:frame:button:4:target" content="${SITE}/" />
  </head><body></body></html>`
  
  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(html)
}
