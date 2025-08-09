// pages/.well-known/farcaster.json.js

export default function handler(req, res) {
  // Figure out your site origin dynamically or from env var
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (req.headers['x-forwarded-host']
      ? `https://${req.headers['x-forwarded-host']}`
      : `https://${req.headers.host}`);

  const manifest = {
    name: 'MadFill',
    icon: `${origin}/og/cover.PNG`,
    description: 'Fill the blank. Make it funny. Win the pot.',
    homeUrl: `${origin}/free`,

    // Fill these AFTER signing your payload in the Mini Apps portal
    accountAssociation: {
      header: 'eip191',
      payload: '<paste-signed-payload-here>',
      signature: '<0x_signature_here>',
    },

    // Optional (future): Add a webhook for events from Farcaster
    // webhookUrl: `${origin}/api/farcaster-webhook`
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Cache-Control',
    'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
  );
  res.status(200).json(manifest);
}
