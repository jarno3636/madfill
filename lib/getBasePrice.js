export async function getBasePriceUSD() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
    const data = await res.json()
    return data?.base?.usd || 0
  } catch (err) {
    console.error('Failed to fetch BASE price', err)
    return 0
  }
}
