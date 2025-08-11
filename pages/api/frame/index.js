// pages/api/frame/index.js
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'
const OG = `${SITE}/api/og?screen=index&title=MadFill&subtitle=Fill%20the%20blank%2C%20win%20the%20pot`

export default async function handler(req, res) {
  const pageUrl = `${SITE}/`
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="MadFill — Fill the blank, win the pot." />
    <meta property="og:image" content="${OG}" />

    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${OG}" />

    <meta name="fc:frame:button:1" content="🏠 Open MadFill" />
    <meta name="fc:frame:button:1:action" content="link" />
    <meta name="fc:frame:button:1:target" content="${pageUrl}" />

    <meta name="fc:frame:button:2" content="🔥 Active Rounds" />
    <meta name="fc:frame:button:2:action" content="link" />
    <meta name="fc:frame:button:2:target" content="${SITE}/active" />

    <meta name="fc:frame:button:3" content="🎨 Make Your Own" />
    <meta name="fc:frame:button:3:action" content="link" />
    <meta name="fc:frame:button:3:target" content="${SITE}/myo" />

    <meta name="fc:frame:button:4" content="🎯 Play Free" />
    <meta name="fc:frame:button:4:action" content="link" />
    <meta name="fc:frame:button:4:target" content="${SITE}/free" />
  </head><body></body></html>`
  
  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(html)
}
