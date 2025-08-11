// pages/api/frame/index.js

// Build an absolute base URL (production-safe)
function getBaseUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`.replace(/\/$/, '');
}

function htmlFor({ title, image, pageUrl, postUrl }) {
  return `<!DOCTYPE html>
<html>
  <head>
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
  const screen = (req.query.screen || 'home').toString();

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

  // POST interactions (stay in-frame)
  if (req.method === 'POST') {
    // Warpcast sends button index in untrustedData.buttonIndex
    const btn =
      req.body?.untrustedData?.buttonIndex ??
      req.body?.buttonIndex ??
      null;

    // Example interaction: button 2 shuffles to a generic default
    if (String(btn) === '2') {
      image = `${baseUrl}/og/default.png`;
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(
    htmlFor({
      title,
      image,
      pageUrl,
      postUrl,
    })
  );
}
