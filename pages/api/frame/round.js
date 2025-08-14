// pages/api/frame/round.js

// Build an absolute base URL (production-safe)
function getBaseUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'https').toString();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
  return `${proto}://${host}`.replace(/\/$/, '');
}

function clampInt(v, min, max, d = 1) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d;
}
function qs(obj) {
  const p = new URLSearchParams();
  if (obj.id != null) p.set('id', String(obj.id));
  return p.toString();
}

// Warpcast POST body can be JSON or raw string; parse safely
function parseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return b;
}

function frameHtml({ baseUrl, id }) {
  const pageUrl = `${baseUrl}/round/${id}`;
  const og = `${baseUrl}/api/og?screen=round&roundId=${id}`;

  return `<!doctype html><html><head>
    <meta charSet="utf-8" />
    <meta property="og:title" content="MadFill — Round #${id}" />
    <meta property="og:image" content="${og}" />

    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${og}" />
    <meta name="fc:frame:post_url" content="${baseUrl}/api/frame/round?${qs({ id })}" />

    <meta name="fc:frame:button:1" content="🔎 Open Round #${id}" />
    <meta name="fc:frame:button:1:action" content="link" />
    <meta name="fc:frame:button:1:target" content="${pageUrl}" />

    <meta name="fc:frame:button:2" content="◀️ Prev" />
    <meta name="fc:frame:button:2:action" content="post" />

    <meta name="fc:frame:button:3" content="▶️ Next" />
    <meta name="fc:frame:button:3:action" content="post" />

    <meta name="fc:frame:button:4" content="🔗 Share Link" />
    <meta name="fc:frame:button:4:action" content="link" />
    <meta name="fc:frame:button:4:target" content="${pageUrl}" />
  </head><body></body></html>`;
}

export default async function handler(req, res) {
  try {
    const baseUrl = getBaseUrl(req);
    const url = new URL(req.url, baseUrl);
    let id = clampInt(url.searchParams.get('id'), 1, 1_000_000, 1);

    if (req.method === 'POST') {
      const body = parseBody(req);
      const ix = Number(body?.untrustedData?.buttonIndex || body?.buttonIndex || 0);
      if (ix === 2) id = clampInt(id - 1, 1, 1_000_000, 1); // Prev
      if (ix === 3) id = clampInt(id + 1, 1, 1_000_000, 1); // Next

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
      return res.status(200).send(frameHtml({ baseUrl, id }));
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).end('Method Not Allowed');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
    return res.status(200).send(frameHtml({ baseUrl, id }));
  } catch {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send('<!doctype html><html><head></head><body></body></html>');
  }
}
