import type { NextApiRequest, NextApiResponse } from 'next';

// Simple router for "screens" so one endpoint can serve multiple pages
function viewFor(screen: string, title: string, image: string, url: string) {
  return `<!DOCTYPE html>
  <html><head>
    <meta property="og:title" content="${title}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />

    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${image}" />
    <meta property="fc:frame:post_url" content="${url}/api/frame?screen=${encodeURIComponent(screen)}" />

    <meta property="fc:frame:button:1" content="Open" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:button:2" content="Shuffle" />
    <meta property="fc:frame:button:2:action" content="post" />
  </head><body></body></html>`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app';
  const baseUrl = host.replace(/\/$/, '');
  const screen = (req.query.screen as string) || 'home';

  // You can branch by screen or request body to render different states
  let title = 'MadFill — Create or Join a Round';
  let image = `${baseUrl}/og/home.png`;
  let pageUrl = `${baseUrl}`;

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
  }

  // For POSTs, you can randomize/shuffle/change state based on button index
  // Warpcast sends JSON with postBody or form fields; you can parse and select a new image
  if (req.method === 'POST') {
    // Example: rotate to a generic default on button 2
    const btn = (req.body?.untrustedData?.buttonIndex ?? req.body?.buttonIndex ?? '').toString();
    if (btn === '2') {
      image = `${baseUrl}/og/default.png`;
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(viewFor(screen, title, image, baseUrl));
}
