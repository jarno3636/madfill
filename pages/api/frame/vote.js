// pages/api/frame/vote.js

// Build an absolute base URL (production-safe)
function getBaseUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'https').toString();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
  return `${proto}://${host}`.replace(/\/$/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  const baseUrl = getBaseUrl(req);
  const pageUrl = `${baseUrl}/vote`;
  const og = `${baseUrl}/api/og?screen=vote&title=Community%20Vote`;

  const html = `<!doctype html><html><head>
    <meta charSet="utf-8" />
    <meta property="og:title" content="MadFill — Community Vote" />
    <meta property="og:image" content="${og}" />

    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${og}" />

    <meta name="fc:frame:button:1" content="🗳️ Vote Now" />
    <meta name="fc:frame:button:1:action" content="link" />
    <meta name="fc:frame:button:1:target" content="${pageUrl}" />
  </head><body></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}
