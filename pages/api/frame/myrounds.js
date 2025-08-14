// pages/api/frame/myrounds.js
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app').replace(/\/$/, '');
const OG = `${SITE}/api/og?screen=myrounds&title=My%20Rounds`;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  const pageUrl = `${SITE}/myrounds`;
  const html = `<!doctype html><html><head>
    <meta charSet="utf-8" />
    <meta property="og:title" content="MadFill — My Rounds" />
    <meta property="og:image" content="${OG}" />

    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${OG}" />

    <meta name="fc:frame:button:1" content="📜 Open My Rounds" />
    <meta name="fc:frame:button:1:action" content="link" />
    <meta name="fc:frame:button:1:target" content="${pageUrl}" />
  </head><body></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}
