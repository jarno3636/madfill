// pages/api/frame/vote.js
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'
const og = `${SITE}/api/og?screen=vote&title=Community%20Vote`

export default async function handler(req, res) {
  const pageUrl = `${SITE}/vote`

  const html = `<!doctype html><html><head>
    <meta property="og:title" content="MadFill — Community Vote" />
    <meta property="og:image" content="${og}" />

    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${og}" />

    <meta name="fc:frame:button:1" content="🗳️ Vote Now" />
    <meta name="fc:frame:button:1:action" content="link" />
    <meta name="fc:frame:button:1:target" content="${pageUrl}" />
  </head><body></body></html>`

  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(html)
}
