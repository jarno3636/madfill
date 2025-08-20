// pages/api/nfts/[address].js
import { ethers } from 'ethers'

/** ---------- Config ---------- */
const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC || process.env.BASE_RPC || 'https://mainnet.base.org'

const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  process.env.NFT_TEMPLATE_ADDRESS ||
  '0xCA699Fb766E3FaF36AC31196fb4bd7184769DD20'

/** ---------- Minimal read ABI ---------- */
const NFT_READ_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  // contract-specific quick read
  'function templateOf(uint256 tokenId) view returns (string title, string description, string theme, string[] parts, uint64 createdAt, address author)'
]

/** ---------- Helpers ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function withRetry(fn, { tries = 4, minDelay = 120, maxDelay = 800, signal } = {}) {
  let last
  for (let i = 0; i < tries; i++) {
    if (signal?.aborted) throw new Error('aborted')
    try { return await fn() } catch (e) {
      last = e
      const msg = String(e?.message || e)
      if (/aborted|revert|CALL_EXCEPTION/i.test(msg)) break
      const backoff = Math.min(maxDelay, minDelay * Math.pow(2, i)) + Math.floor(Math.random() * 80)
      await sleep(backoff)
    }
  }
  throw last
}

function mapLimit(items, limit, worker) {
  let i = 0
  let active = 0
  const out = new Array(items.length)
  return new Promise((resolve) => {
    const next = () => {
      if (i >= items.length && active === 0) return resolve(out)
      while (active < limit && i < items.length) {
        const idx = i++
        active++
        Promise.resolve(worker(items[idx], idx))
          .then((v) => { out[idx] = v })
          .catch((e) => { out[idx] = { __error: String(e?.message || e) } })
          .finally(() => { active--; next() })
      }
    }
    next()
  })
}

const ipfsToHttp = (u) => {
  if (!u) return u
  if (u.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${u.slice(7)}`
  return u
}

async function fetchJson(uri) {
  try {
    if (!uri) return null
    if (uri.startsWith('data:')) {
      const [, payload] = uri.split(',', 2)
      return JSON.parse(decodeURIComponent(payload))
    }
    const res = await fetch(ipfsToHttp(uri), { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

function buildTemplateLine(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return ''
  // parts are the fixed chunks around blanks; join with "____"
  return parts.reduce((acc, part, i) => acc + String(part || '') + (i < parts.length - 1 ? '____' : ''), '')
}

/** Scan Transfer logs to find tokenIds when ERC721Enumerable is missing */
async function findTokenIdsByLogs({ provider, nftAddress, owner, maxBack = 1_200_000, chunk = 40_000 }) {
  try {
    const iface = new ethers.Interface(NFT_READ_ABI)
    const topicTransfer = iface.getEvent('Transfer').topicHash
    const ownerTopic = ethers.zeroPadValue(owner, 32).toLowerCase()
    const latest = await provider.getBlockNumber()
    const start = Math.max(0, latest - maxBack)
    const seen = new Set()

    for (let to = latest; to > start; to -= chunk) {
      const from = Math.max(start, to - chunk + 1)
      const logs = await provider.getLogs({
        address: nftAddress,
        fromBlock: from,
        toBlock: to,
        topics: [topicTransfer, null, ownerTopic],
      })
      for (const log of logs) {
        try {
          const parsed = iface.parseLog(log)
          const tid = Number(parsed.args.tokenId)
          seen.add(tid)
        } catch {}
      }
    }

    const nft = new ethers.Contract(nftAddress, NFT_READ_ABI, provider)
    const confirmed = []
    for (const tid of Array.from(seen)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const who = await nft.ownerOf(tid)
        if (who && who.toLowerCase() === owner.toLowerCase()) confirmed.push(tid)
      } catch {}
    }
    return confirmed.sort((a, b) => a - b)
  } catch { return [] }
}

/** ---------- API handler ---------- */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const owner = String(req.query.address || '').trim()
    if (!owner || !ethers.isAddress(owner)) {
      res.status(400).json({ error: 'Invalid address' })
      return
    }

    const controller = new AbortController()
    const { signal } = controller
    const timeout = setTimeout(() => controller.abort(), 12000)

    const provider = new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true })
    const nft = new ethers.Contract(NFT_ADDRESS, NFT_READ_ABI, provider)

    // balance
    const balanceRaw = await withRetry(() => nft.balanceOf(owner), { signal }).catch(() => 0n)
    const bal = Number(balanceRaw || 0)
    if (!bal) {
      clearTimeout(timeout)
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ ok: true, items: [] })
      return
    }

    // discover tokenIds
    let tokenIds = []
    let enumerableOk = true
    for (let i = 0; i < bal; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const tid = await withRetry(() => nft.tokenOfOwnerByIndex(owner, i), { tries: 2, signal })
        tokenIds.push(Number(tid))
      } catch { enumerableOk = false; break }
    }

    if (!enumerableOk && tokenIds.length < bal) {
      const total = Number(await withRetry(() => nft.totalSupply(), { signal }).catch(() => 0n))
      const cap = Math.min(total || 0, 400)
      for (let tid = 1; tokenIds.length < bal && tid <= cap; tid++) {
        // eslint-disable-next-line no-await-in-loop
        const who = await withRetry(() => nft.ownerOf(tid), { tries: 2, signal }).catch(() => null)
        if (signal.aborted) break
        if (who && who.toLowerCase() === owner.toLowerCase()) tokenIds.push(tid)
      }
    }

    if (tokenIds.length < bal) {
      const viaLogs = await findTokenIdsByLogs({ provider, nftAddress: NFT_ADDRESS, owner })
      for (const t of viaLogs) if (!tokenIds.includes(t)) tokenIds.push(t)
    }

    tokenIds = Array.from(new Set(tokenIds)).sort((a, b) => a - b)

    // enrich in parallel (limit)
    const items = await mapLimit(tokenIds, 6, async (id) => {
      try {
        const [uri, tpl] = await Promise.all([
          withRetry(() => nft.tokenURI(id), { tries: 3, signal }).catch(() => ''),
          withRetry(() => nft.templateOf?.(id), { tries: 3, signal }).catch(() => null),
        ])

        const meta = await fetchJson(uri)

        const rawImg = meta?.image || meta?.image_url || ''
        const image =
          ipfsToHttp(rawImg) ||
          (rawImg && `https://cloudflare-ipfs.com/ipfs/${rawImg.replace('ipfs://','')}`) ||
          (rawImg && `https://w3s.link/ipfs/${rawImg.replace('ipfs://','')}`) ||
          ''

        const name = meta?.name || tpl?.title || `Template #${id}`
        const description = meta?.description || tpl?.description || ''
        const theme = tpl?.theme || meta?.theme || ''

        // Prefer onchain parts; else try meta attributes -> string[]
        const parts = Array.isArray(tpl?.parts)
          ? tpl.parts.map(String)
          : Array.isArray(meta?.attributes)
            ? meta.attributes.map(a => String(a?.value ?? a))
            : []

        // Optional "word" from metadata attributes (if present)
        const wordAttr = Array.isArray(meta?.attributes)
          ? (meta.attributes.find(a => (String(a?.trait_type || '')).toLowerCase().includes('word'))?.value || '')
          : ''

        // "story" is a friendly long text where {{word}} could be substituted
        let story = tpl?.description || meta?.description || ''
        if (story && wordAttr) story = story.replace(/\{\{word\}\}/gi, String(wordAttr))

        // Prebuild a template line so the client can just render it
        const templateLine = buildTemplateLine(parts)

        return {
          id,
          tokenId: id,
          tokenURI: uri || '',
          name,
          description,
          theme,
          image,
          parts,
          word: String(wordAttr || ''),
          story: String(story || ''),
          templateLine,
        }
      } catch {
        return { id, tokenId: id }
      }
    })

    clearTimeout(timeout)
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, items })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
}
