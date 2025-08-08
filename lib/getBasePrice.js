// lib/getBasePrice.js
let cachedPrice = 0
let lastFetched = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Small sanity check to ignore junk responses
const isSane = (n) => typeof n === 'number' && isFinite(n) && n > 0.5

export async function getBasePriceUSD(force = false) {
  const now = Date.now()
  if (!force && cachedPrice && now - lastFetched < CACHE_DURATION) {
    return cachedPrice
  }

  // Try sources in order:
  // 1) Coinbase ETH-USD spot
  // 2) CoinGecko l2-standard-bridged-weth-base
  // 3) CoinGecko ethereum
  // 4) Alchemy token metadata (WETH on Base)
  // 5) Last cached or a conservative fallback (3800)
  try {
    // 1) Coinbase
    const cbRes = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', { cache: 'no-store' })
    const cbJson = await cbRes.json().catch(() => ({}))
    const coinbase = parseFloat(cbJson?.data?.amount)
    if (isSane(coinbase)) return remember(coinbase)
  } catch (_) {}

  try {
    // 2) CoinGecko — bridged WETH on Base
    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=l2-standard-bridged-weth-base&vs_currencies=usd', { cache: 'no-store' })
    const cgJson = await cgRes.json().catch(() => ({}))
    const bridged = cgJson?.['l2-standard-bridged-weth-base']?.usd
    if (isSane(bridged)) return remember(bridged)
  } catch (_) {}

  try {
    // 3) CoinGecko — plain ETH as proxy
    const cgRes2 = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', { cache: 'no-store' })
    const cgJson2 = await cgRes2.json().catch(() => ({}))
    const ethUsd = cgJson2?.ethereum?.usd
    if (isSane(ethUsd)) return remember(ethUsd)
  } catch (_) {}

  try {
    // 4) Alchemy token metadata for Base WETH (0x4200...0006)
    const key = process.env.NEXT_PUBLIC_ALCHEMY_KEY || process.env.ALCHEMY_API_KEY
    if (key) {
      const alchemyRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_getTokenMetadata',
          params: ['0x4200000000000000000000000000000000000006'],
        }),
      })
      const alchemyJson = await alchemyRes.json().catch(() => ({}))
      const metaPrice = alchemyJson?.result?.price?.usd
      if (isSane(metaPrice)) return remember(metaPrice)
    }
  } catch (_) {}

  // 5) Fallback
  const fallback = cachedPrice || 3800
  return remember(fallback)

  function remember(val) {
    cachedPrice = val
    lastFetched = Date.now()
    return val
  }
}

export default getBasePriceUSD
