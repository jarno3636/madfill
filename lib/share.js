// lib/share.js
export function buildShareUrls({ url, text = '', embed } = {}) {
  const u = encodeURIComponent(url || '');
  const t = encodeURIComponent(text || '');
  const e = embed ? `&embeds[]=${encodeURIComponent(embed)}` : '';
  return {
    twitter: `https://twitter.com/intent/tweet?text=${t}%20${u}`,
    warpcast: `https://warpcast.com/~/compose?text=${t}${e}`,
  };
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function nativeShare({ title, text, url } = {}) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
