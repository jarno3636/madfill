// pages/api/frame/index.js

// Build an absolute base URL (production-safe)
function getBaseUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'https').toString();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
  return `${proto}://${host}`.replace(/\/$/, '');
}

// Basic clamps/sanitizers for small string params used inside meta tags
const clamp = (s = '', n = 64) => String(s).replace(/\s+/g, ' ').slice(0, n);
const sanitizeScreen = (s) => {
  const v = String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  return v || 'home';
};

// Warpcast POST body can be JSON or raw string; parse safely
function parseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return b;
}

function htmlFor({ title, image, pageUrl, postUrl }) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charSet="utf-8" />
    <meta property="og:title" content="${title}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />

    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${image}" />
    <meta property="fc:frame:post_url" content="${postUrl}" />

    <meta property="fc:frame:button:1" content="Open" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:button:2" content="Shuffle" />
    <meta property="fc:frame:button:2:action" content="post" />
  </head>
  <body></body>
</html>`;
}

export default async function handler(req, res) {
  const baseUrl = getBaseUrl(req);
  const screen = sanitizeScreen((req.query?.screen || 'home').toString());

  // defaults
  let title = 'MadFill — Create or Join a Round';
  let image = `${baseUrl}/og/home.png`;
  let pageUrl = `${baseUrl}`;
  let postUrl = `${baseUrl}/api/frame?screen=${encodeURIComponent(screen)}`;

  // map screens -> static fallbacks
  if (screen === 'vote') {
    title = 'Community Vote — MadFill';
    image = `${baseUrl}/og/vote.png`;
    pageUrl = `${baseUrl}/vote`;
  } else if (screen === 'free') {
    title = 'Free MadFill — Play Now';
    image = `${baseUrl}/og/free.png`;
    pageUrl = `${baseUrl}/free`;
  } else if (screen === 'myo') {
    title = 'Make Your Own — MadFill';
    image = `${baseUrl}/og/myo.png`;
    pageUrl = `${baseUrl}/myo`;
  } else if (screen === 'round') {
    title = 'MadFill Round';
    image = `${baseUrl}/og/round.png`;
    pageUrl = `${baseUrl}/active`;
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const btn = body?.untrustedData?.buttonIndex ?? body?.buttonIndex ?? null;

    // Example interaction: button 2 shuffles to a generic default image while staying in-frame
    if (String(btn) === '2') {
      image = `${baseUrl}/og/default.png`;
      title = clamp(title, 80);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).send(
      htmlFor({
        title,
        image,
        pageUrl,
        postUrl,
      })
    );
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).send(
    htmlFor({
      title,
      image,
      pageUrl,
      postUrl,
    })
  );
}
