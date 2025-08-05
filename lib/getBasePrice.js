// lib/getBasePrice.js
let cachedPrice = 0
let lastFetched = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getBasePriceUSD() {
  const now = Date.now()
  if (cachedPrice && now - lastFetched < CACHE_DURATION) {
    return cachedPrice
  }

  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
    const data = await res.json()
    const price = data?.base?.usd || 0
    if (price) {
      cachedPrice = price
      lastFetched = now
    }
    return price
  } catch (err) {
    console.error('Failed to fetch BASE price', err)
    return cachedPrice || 0
  }
}
