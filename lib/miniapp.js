// lib/miniapp.js
export async function isMiniApp() {
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    return !!mod?.sdk
  } catch {
    return false
  }
}

/**
 * Open a URL *inside* the Farcaster Mini App when possible.
 * Falls back to same-tab navigation, then window.open.
 */
export async function openInMini(url) {
  if (!url) return
  const safe = new URL(url, (typeof window !== 'undefined' && window.location?.origin) || 'https://madfill.vercel.app').toString()
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    if (mod?.sdk?.actions?.openURL) {
      await mod.sdk.actions.openURL(safe)  // stays inside Warpcast Mini App
      return true
    }
  } catch {
    /* not in mini-app; fall through */
  }
  try {
    if (typeof window !== 'undefined') {
      // Prefer same-tab so users on mobile don’t get bounced to external browser
      window.location.assign(safe)
      return true
    }
  } catch {
    /* ignore */
  }
  try {
    window?.open?.(safe, '_self', 'noopener,noreferrer') // final fallback
    return true
  } catch {
    return false
  }
}
