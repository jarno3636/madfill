// lib/shareFreeCast.js

const LIMITS = {
  farcaster: 320,
  twitter: 280,
};

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
  const quote = `"${sentence}"`;
  const filled = `I filled in: ${word}`;
  return { header, quote, filled };
}

// -------- Warpcast (Farcaster) --------

export function buildFreeCastUrl({
  sentence,
  word,
  link = 'https://madfill.vercel.app/free',
  embedUrl,
} = {}) {
  const base = 'https://warpcast.com/~/compose';
  const { header, quote, filled } = baseLines(sentence, word);
  const tail = `Play your own here 👉 ${link} #MadFill #OnChainGames`;

  const reservedTail = tail.length + 2; // "\n\n"
  const body = `${header}\n\n${quote}\n\n${filled}`;
  const bodyTrimmed = truncate(body, LIMITS.farcaster, reservedTail);
  const text = `${bodyTrimmed}\n\n${tail}`;

  const params = new URLSearchParams({ text });
  if (embedUrl) params.append('embeds[]', embedUrl);

  return `${base}?${params.toString()}`;
}

export async function shareFreeCast(args = {}) {
  const url = buildFreeCastUrl(args);
  if (typeof window === 'undefined') return url;
  const opened = window.open(url, args.newTab === false ? '_self' : '_blank');
  if (!opened && navigator?.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); } catch {}
  }
  return url;
}

// -------- Twitter / X --------

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

  const tail = `Play your own here 👉 ${link}`;
  const hashLine = tags ? `\n#${tags.split(',').join(' #')}` : '';
  const reservedTail = tail.length + hashLine.length + 2;

  const body = `${header}\n\n${quote}\n\n${filled}`;
  const bodyTrimmed = truncate(body, LIMITS.twitter, reservedTail);
  const text = `${bodyTrimmed}\n\n${tail}${hashLine}`;

  const params = new URLSearchParams({ text });
  if (via) params.set('via', via.replace(/^@/, ''));

  return `${base}?${params.toString()}`;
}

export async function shareFreeTweet(args = {}) {
  const url = buildTwitterFreeUrl(args);
  if (typeof window === 'undefined') return url;
  const opened = window.open(url, args.newTab === false ? '_self' : '_blank');
  if (!opened && navigator?.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); } catch {}
  }
  return url;
}

// -------- Convenience: choose platform --------

export async function shareFree({ platform = 'warpcast', ...rest } = {}) {
  return platform === 'twitter' ? shareFreeTweet(rest) : shareFreeCast(rest);
}
