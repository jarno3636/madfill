// lib/shareFreeCast.js

const LIMITS = {
  farcaster: 320,
  twitter: 280,
};

/** ---------- small helpers ---------- */
function getOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app';
}

function absUrl(u = '') {
  try {
    return new URL(String(u || ''), getOrigin()).toString();
  } catch {
    return '';
  }
}

function normalizeHashtags(h) {
  if (!h) return '';
  const arr = Array.isArray(h) ? h : h.split(',').map(s => s.trim()).filter(Boolean);
  return arr.join(',');
}

function truncate(text, limit, reserveTail = 0) {
  const max = Math.max(0, limit - reserveTail);
  if (!text) return '';
  if (text.length <= max) return text;
  const slice = text.slice(0, Math.max(0, max - 1));
  const cut = slice.lastIndexOf(' ');
  return (cut > 40 ? slice.slice(0, cut) : slice).trimEnd() + '…';
}

function baseLines(sentence = '', word = '') {
  const header = '😄 I played a round of Free MadFill!';
  const quote = sentence ? `"${sentence}"` : '';
  const filled = word ? `I filled in: ${word}` : '';
  return { header, quote, filled };
}

/** Build a /api/og URL without importing other modules */
function buildLocalOg(params = {}) {
  const u = new URL('/api/og', getOrigin());
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  });
  return u.toString();
}

/** Ensure embeds are absolute; accept string or array */
function normalizeEmbeds(embedUrl, embeds) {
  const list = [];
  if (embedUrl) list.push(embedUrl);
  if (Array.isArray(embeds)) list.push(...embeds);
  return list.map(absUrl).filter(Boolean);
}

/* ===========================================================
   FARCASTER / WARPCAST
   =========================================================== */

export function buildFreeCastUrl({
  sentence,
  word,
  link = 'https://madfill.vercel.app/free',
  embedUrl,
  embeds,                 // optional array of additional embeds
  autoEmbedOg = true,     // if no embed provided, auto-generate /api/og
  ogParams = {},          // { title, subtitle, screen, roundId, ... }
} = {}) {
  const base = 'https://warpcast.com/~/compose';
  const { header, quote, filled } = baseLines(sentence, word);
  const tail = `Play your own here 👉 ${absUrl(link)} #MadFill #OnChainGames`;

  // Compose body + reserve tail space
  const bodyParts = [header, quote, filled].filter(Boolean);
  const body = bodyParts.join('\n\n');
  const reservedTail = tail.length + 2; // "\n\n"
  const bodyTrimmed = truncate(body, LIMITS.farcaster, reservedTail);
  const text = `${bodyTrimmed}\n\n${tail}`;

  // Embeds: use provided, or optional auto /api/og
  let embedList = normalizeEmbeds(embedUrl, embeds);
  if (autoEmbedOg && embedList.length === 0) {
    const fallbackOg = buildLocalOg({
      screen: 'free',
      title: 'Free MadFill',
      subtitle: sentence ? `“${String(sentence).slice(0, 80)}”` : undefined,
      ...ogParams,
    });
    embedList = [fallbackOg];
  }

  const params = new URLSearchParams({ text });
  for (const e of embedList) params.append('embeds[]', e);

  return `${base}?${params.toString()}`;
}

export async function shareFreeCast(args = {}) {
  const url = buildFreeCastUrl(args);
  // SSR: just return the URL
  if (typeof window === 'undefined') return url;

  // Prefer Farcaster MiniApp openURL if available
  try {
    const mod = await import('@farcaster/miniapp-sdk');
    if (mod?.sdk?.actions?.openURL) {
      await mod.sdk.actions.openURL(url);
      return url;
    }
  } catch {
    // ignore and fall through to window.open
  }

  const opened = window.open(url, args.newTab === false ? '_self' : '_blank', 'noopener,noreferrer');
  if (!opened && navigator?.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); } catch {}
  }
  return url;
}

/* ===========================================================
   TWITTER / X
   =========================================================== */

export function buildTwitterFreeUrl({
  sentence,
  word,
  link = 'https://madfill.vercel.app/free',
  via,
  hashtags,
} = {}) {
  const base = 'https://twitter.com/intent/tweet';
  const { header, quote, filled } = baseLines(sentence, word);

  const tags = normalizeHashtags(
    ['MadFill', 'OnChainGames', ...(Array.isArray(hashtags) ? hashtags : (hashtags ? hashtags.split(',') : []))]
  );

  const tail = `Play your own here 👉 ${absUrl(link)}`;
  const hashLine = tags ? `\n#${tags.split(',').join(' #')}` : '';
  const reservedTail = tail.length + hashLine.length + 2;

  const bodyParts = [header, quote, filled].filter(Boolean);
  const body = bodyParts.join('\n\n');
  const bodyTrimmed = truncate(body, LIMITS.twitter, reservedTail);
  const text = `${bodyTrimmed}\n\n${tail}${hashLine}`;

  const params = new URLSearchParams({ text });
  if (via) params.set('via', String(via).replace(/^@/, ''));

  return `${base}?${params.toString()}`;
}

export async function shareFreeTweet(args = {}) {
  const url = buildTwitterFreeUrl(args);
  if (typeof window === 'undefined') return url;
  const opened = window.open(url, args.newTab === false ? '_self' : '_blank', 'noopener,noreferrer');
  if (!opened && navigator?.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); } catch {}
  }
  return url;
}

/* ===========================================================
   Convenience: choose platform
   =========================================================== */

export async function shareFree({ platform = 'warpcast', ...rest } = {}) {
  return platform === 'twitter' ? shareFreeTweet(rest) : shareFreeCast(rest);
}
