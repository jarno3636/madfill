// lib/getBasePrice.js

let cachedPrice = 0
let lastFetched = 0
let inFlight = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const DEFAULT_FALLBACK = 3800 // conservative fallback

// Small sanity check to ignore junk responses
const isSane = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0.5

// Helper: fetch with timeout & safe JSON parsing
async function fetchJSON(url, init = {}, timeoutMs = 6000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const id = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const res = await fetch(url, { ...init, signal: ctrl?.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    // Some endpoints return text occasionally; guard JSON parse
    const txt = await res.text()
    try {
      return JSON.parse(txt)
    } catch {
      // try number-only responses gracefully
      return txt ? { value: Number(txt) } : {}
    }
  } finally {
    if (id) clearTimeout(id)
  }
}

// Remember & update cache
function remember(val) {
  cachedPrice = val
  lastFetched = Date.now()
  return val
}

export async function getBasePriceUSD(force = false) {
  const now = Date.now()
  if (!force && cachedPrice && now - lastFetched < CACHE_DURATION) {
    return cachedPrice
  }
  if (inFlight) return inFlight

  inFlight = (async () => {
    // Try sources in order:
    // 1) Coinbase ETH-USD spot
    try {
      const cbJson = await fetchJSON('https://api.coinbase.com/v2/prices/ETH-USD/spot', { cache: 'no-store' })
      const coinbase = parseFloat(cbJson?.data?.amount)
      if (isSane(coinbase)) return remember(coinbase)
    } catch (_) {}

    // 2) CoinGecko — bridged WETH on Base
    try {
      const cgJson = await fetchJSON(
        'https://api.coingecko.com/api/v3/simple/price?ids=l2-standard-bridged-weth-base&vs_currencies=usd',
        { cache: 'no-store' }
      )
      const bridged = cgJson?.['l2-standard-bridged-weth-base']?.usd
      if (isSane(bridged)) return remember(bridged)
    } catch (_) {}

    // 3) CoinGecko — plain ETH as proxy
    try {
      const cgJson2 = await fetchJSON(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        { cache: 'no-store' }
      )
      const ethUsd = cgJson2?.ethereum?.usd
      if (isSane(ethUsd)) return remember(ethUsd)
    } catch (_) {}

    // 4) Alchemy token metadata for Base WETH (0x4200...0006) — server-only if secret
    try {
      const isServer = typeof window === 'undefined'
      const publicKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY
      const serverKey = isServer ? process.env.ALCHEMY_API_KEY : null
      const key = publicKey || serverKey
      if (key) {
        const url = `https://base-mainnet.g.alchemy.com/v2/${key}`
        const alchemyJson = await fetchJSON(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: 1,
              jsonrpc: '2.0',
              method: 'alchemy_getTokenMetadata',
              params: ['0x4200000000000000000000000000000000000006'],
            }),
          },
          7000
        )
        const metaPrice = alchemyJson?.result?.price?.usd
        if (isSane(metaPrice)) return remember(metaPrice)
      }
    } catch (_) {}

    // 5) Fallback to cached or conservative constant
    return remember(cachedPrice || DEFAULT_FALLBACK)
  })()

  try {
    const result = await inFlight
    return result
  } finally {
    inFlight = null
  }
}

export default getBasePriceUSD
