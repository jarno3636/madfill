// lib/neynar.js

/** ---------- Type guards ---------- */
function isHexAddress(x) {
  return typeof x === 'string' && /^0x[a-fA-F0-9]{40}$/.test(x)
}
function isNumeric(x) {
  return (typeof x === 'string' || typeof x === 'number') &&
    String(x).trim() !== '' && /^[0-9]+$/.test(String(x))
}
function normUsername(x) {
  if (typeof x !== 'string') return ''
  return x.replace(/^@/, '').trim().toLowerCase()
}

/** ---------- API base (supports SSR & client) ---------- */
function getApiBase() {
  // In the browser, relative URL is ideal (respects webview, previews, etc.)
  if (typeof window !== 'undefined') return ''
  // On server, compute an absolute origin safely.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL
  if (explicit) return explicit.startsWith('http') ? explicit : `https://${explicit}`
  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`
  // Fallback to localhost (best-effort for dev SSR)
  return 'http://localhost:3000'
}

/** ---------- Minimal cache ---------- */
const _cache = new Map() // key -> { value, ts }
const _inflight = new Map() // key -> Promise
const MAX_CACHE = 200
const TTL_MS = 5 * 60 * 1000

function _getCached(key) {
  const hit = _cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.ts > TTL_MS) {
    _cache.delete(key)
    return null
  }
  return hit.value
}
function _setCached(key, value) {
  if (_cache.size >= MAX_CACHE) {
    // drop the oldest (simple FIFO)
    const firstKey = _cache.keys().next().value
    if (firstKey) _cache.delete(firstKey)
  }
  _cache.set(key, { value, ts: Date.now() })
}

/** ---------- Fetch with timeout ---------- */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const t = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const res = await fetch(url, { ...opts, signal: controller?.signal })
    return res
  } finally {
    if (t) clearTimeout(t)
  }
}

/**
 * Normalize Farcaster user object to:
 * { fid, username, displayName, pfp_url } | null
 */
function coerceUser(u) {
  if (!u) return null
  const user = u.user || u // accept {user: {...}} or direct
  return {
    fid: user?.fid ?? null,
    username: user?.username ?? null,
    displayName: user?.displayName ?? user?.display_name ?? null,
    pfp_url: user?.pfp_url ?? user?.pfp?.url ?? null,
  }
}

/**
 * Fetch a Farcaster profile by fid, EVM address, or username.
 * Returns: { fid, username, displayName, pfp_url } | null
 *
 * NOTE: expects an internal API route at /api/fc-profile that accepts one of:
 *   ?fid=..., ?address=..., ?username=...
 * // TODO(api): verify /api/fc-profile exists and its returned JSON shape matches coerceUser().
 */
export async function fetchFarcasterProfile(idOrAddrOrUsername) {
  const key = `one:${String(idOrAddrOrUsername)}`
  const cached = _getCached(key)
  if (cached !== null) return cached

  // De-duplicate concurrent calls for the same key
  if (_inflight.has(key)) return _inflight.get(key)

  const p = (async () => {
    try {
      const base = getApiBase()
      const params = new URLSearchParams()

      if (isHexAddress(idOrAddrOrUsername)) {
        params.set('address', idOrAddrOrUsername)
      } else if (isNumeric(idOrAddrOrUsername)) {
        params.set('fid', String(idOrAddrOrUsername))
      } else if (typeof idOrAddrOrUsername === 'string' && idOrAddrOrUsername.trim()) {
        params.set('username', normUsername(idOrAddrOrUsername))
      } else {
        _setCached(key, null)
        return null
      }

      const url = `${base.replace(/\/$/, '')}/api/fc-profile?${params.toString()}`
      const res = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, 10000)
      if (!res.ok) {
        _setCached(key, null)
        return null
      }
      const json = await res.json().catch(() => ({}))
      const v = coerceUser(json)
      _setCached(key, v)
      return v
    } catch (err) {
      console.warn('fetchFarcasterProfile failed:', err)
      _setCached(key, null)
      return null
    } finally {
      _inflight.delete(key)
    }
  })()

  _inflight.set(key, p)
  return p
}

/**
 * Batch helper. Accepts an array of fids / addresses / usernames.
 * Returns array of normalized profiles (null where not found), preserving order.
 */
export async function fetchManyFarcasterProfiles(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return []
  // Try to serve from cache where possible; fetch the rest individually.
  const pending = []
  const out = new Array(ids.length).fill(null)

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const key = `one:${String(id)}`
    const cached = _getCached(key)
    if (cached !== null) {
      out[i] = cached
    } else {
      pending.push(
        fetchFarcasterProfile(id).then((v) => {
          out[i] = v
        })
      )
    }
  }

  if (pending.length) {
    await Promise.allSettled(pending)
  }
  return out
}
