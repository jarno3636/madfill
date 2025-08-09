// pages/api/frame/free.js
// A minimal Farcaster Frame that cycles your Free Game template + words
// Uses your existing /api/og generator for the image.
//
// Cast/link THIS URL (https://<your-host>/api/frame/free) on Warpcast.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://madfill.vercel.app";
const OG = (q) => `${SITE}/api/og?${q}`;

// Simple “state” via querystring (c = category, t = template, w = comma words)
function parseQS(url) {
  const u = new URL(url, SITE);
  return {
    c: clampInt(u.searchParams.get("c"), 0, 99, 0),
    t: clampInt(u.searchParams.get("t"), 0, 99, 0),
    w: (u.searchParams.get("w") || "").split(",").map((s) => sanitize(s)).join(","),
  };
}
const clampInt = (v, min, max, d=0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d;
}
const sanitize = (s) =>
  String(s || "")
    .trim()
    .split(" ")[0]
    .replace(/[^a-zA-Z0-9\-_]/g, "")
    .slice(0, 16);

// Rebuild QS
function qs(obj) {
  const p = new URLSearchParams();
  if (obj.c != null) p.set("c", String(obj.c));
  if (obj.t != null) p.set("t", String(obj.t));
  if (obj.w != null) p.set("w", String(obj.w));
  return p.toString();
}

// Pick randoms (client doesn’t know your templates; we just vary indices/words visually)
const TOKENS = ["neon","taco","llama","vibe","laser","noodle","glow","pixel","dino","jazz","biscuit","vortex","meta","sprocket"];
const rand = (n) => Math.floor(Math.random() * n);
const randWord = () => TOKENS[rand(TOKENS.length)];

// Build the HTML with frame meta tags
function frameHtml({ imageUrl, postUrl, c, t, w }) {
  // Button set:
  // 1) Surprise Me  2) Random Template  3) Play on Web (url)  4) Copy Link (url)
  const playUrl = `${SITE}/free?${qs({ c, t, w })}`;
  return `<!doctype html>
<html>
  <head>
    <meta property="og:title" content="MadFill — Free Game" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${imageUrl}" />
    <meta name="fc:frame:post_url" content="${postUrl}" />

    <meta name="fc:frame:button:1" content="🪄 Surprise Me" />
    <meta name="fc:frame:button:1:action" content="post" />

    <meta name="fc:frame:button:2" content="🎲 Random Template" />
    <meta name="fc:frame:button:2:action" content="post" />

    <meta name="fc:frame:button:3" content="▶️ Play on Web" />
    <meta name="fc:frame:button:3:action" content="link" />
    <meta name="fc:frame:button:3:target" content="${playUrl}" />

    <meta name="fc:frame:button:4" content="🔗 Copy Link" />
    <meta name="fc:frame:button:4:action" content="link" />
    <meta name="fc:frame:button:4:target" content="${playUrl}" />
  </head>
  <body />
</html>`;
}

export default async function handler(req, res) {
  try {
    // Current "state" from the request URL
    const { c, t, w } = parseQS(req.url);

    // Handle posts from buttons
    if (req.method === "POST") {
      let next = { c, t, w };
      try {
        const body = req.body || {};
        const ix = Number(body?.untrustedData?.buttonIndex || 0);

        if (ix === 1) {
          // Surprise Me → swap in 3 fun words
          const words = w ? w.split(",") : [];
          const w1 = words[0] || randWord();
          const w2 = words[1] || randWord();
          const w3 = words[2] || randWord();
          next.w = [w1, w2, w3].map(sanitize).join(",");
        } else if (ix === 2) {
          // Random Template → shuffle c/t
          next.c = rand(7);     // adjust to your categories count if you want
          next.t = rand(6);     // adjust to your max templates per category
        }
      } catch {}

      const postUrl = `${SITE}/api/frame/free?${qs(next)}`;
      const imageUrl = OG(`screen=free&title=Free%20MadFill&subtitle=Make%20a%20card!&${qs(next)}`);

      res.setHeader("Content-Type", "text/html");
      res.status(200).send(frameHtml({ imageUrl, postUrl, ...next }));
      return;
    }

    // Initial GET render
    const postUrl = `${SITE}/api/frame/free?${qs({ c, t, w })}`;
    const imageUrl = OG(`screen=free&title=Free%20MadFill&subtitle=Make%20a%20card!&${qs({ c, t, w })}`);

    res.setHeader("Content-Type", "text/html");
    res.status(200).send(frameHtml({ imageUrl, postUrl, c, t, w }));
  } catch (e) {
    res.status(200).send("<!doctype html><html><head></head><body></body></html>");
  }
}
