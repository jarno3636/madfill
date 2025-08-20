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
  // optional quick-read (if present on your contract)
  'function templateOf(uint256 tokenId) view returns (string title, string description, string theme, string[] parts, uint64 createdAt, address author)'
]

/** ---------- Helpers ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function withRetry(fn, { tries = 4, minDelay = 120, maxDelay = 900, signal } = {}) {
  let last
  for (let i = 0; i < tries; i++) {
    if (signal?.aborted) throw new Error('aborted')
    try { return await fn() } catch (e) {
      last = e
      const msg = String(e?.message || e)
      if (/aborted|revert|CALL_EXCEPTION/i.test(msg)) break
      const backoff = Math.min(maxDelay, minDelay * (1 << i)) + Math.floor(Math.random() * 80)
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
    const urls = [
      ipfsToHttp(uri),
      uri.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/'),
      uri.replace('ipfs://', 'https://w3s.link/ipfs/'),
    ].filter(Boolean)

    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: 'no-store' })
        if (res.ok) return await res.json()
      } catch {}
    }
    return null
  } catch { return null }
}

/** Try multiple layouts to extract template parts */
function extractParts(meta, tpl) {
  // 1) On-chain tuple wins if present
  if (tpl && Array.isArray(tpl.parts) && tpl.parts.length) {
    return tpl.parts.map((s) => String(s ?? ''))
  }

  // 2) Top-level parts
  if (Array.isArray(meta?.parts) && meta.parts.length) {
    return meta.parts.map((s) => String(s ?? ''))
  }

  // 3) properties.parts (common on some mints)
  if (Array.isArray(meta?.properties?.parts) && meta.properties.parts.length) {
    return meta.properties.parts.map((s) => String(s ?? ''))
  }

  // 4) attributes that look like parts: part_0 / Part 0 / etc
  if (Array.isArray(meta?.attributes)) {
    const numbered = []
    const loose = []
    for (const a of meta.attributes) {
      const key = String(a?.trait_type || a?.trait || '').toLowerCase()
      const val = a?.value ?? ''
      if (!val && typeof a === 'string') {
        loose.push(String(a))
        continue
      }
      const m = key.match(/part[_\s-]?(\d+)/i)
      if (m) {
        numbered.push({ i: Number(m[1]), v: String(val ?? '') })
      } else if (/^part$/.test(key)) {
        loose.push(String(val ?? ''))
      }
    }
    if (numbered.length) {
      return numbered.sort((a,b)=>a.i-b.i).map(x=>x.v)
    }
    if (loose.length) return loose
  }

  // 5) Fallback: split description around blanks “____”
  const desc = String(meta?.description || tpl?.description || '')
  if (desc.includes('____')) {
    // pieces between blanks; make sure last piece is kept
    const segs = desc.split('____').map((s) => s)
    // e.g. A ____ B ____ C  -> parts = ["A ", " B ", " C"]
    // we want exactly N blanks => N+1 parts
    return segs
  }

  return []
}

/** Guess a user-filled word if present in metadata */
function extractWord(meta) {
  if (!Array.isArray(meta?.attributes)) return ''
  const hit = meta.attributes.find(a =>
    String(a?.trait_type || '').toLowerCase().includes('word')
  )
  return String(hit?.value || '')
}

/** Scan Transfer logs to find tokenIds when ERC721Enumerable is missing/sparse */
async function findTokenIdsByLogs({ provider, nftAddress, owner, maxBack = 1_200_000, chunk = 40_000 }) {
  try {
    const iface = new ethers.Interface(NFT_READ_ABI)
    const topicTransfer = iface.getEventTopic('Transfer') // ethers v6
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

    // Confirm ownership now
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

        // image (fallbacks)
        const rawImg = meta?.image || meta?.image_url || ''
        const image =
          (rawImg && ipfsToHttp(rawImg)) ||
          (rawImg && `https://cloudflare-ipfs.com/ipfs/${rawImg.replace('ipfs://','')}`) ||
          (rawImg && `https://w3s.link/ipfs/${rawImg.replace('ipfs://','')}`) ||
          ''

        const parts = extractParts(meta, tpl)
        const wordAttr = extractWord(meta)

        const name = meta?.name || tpl?.title || `Template #${id}`
        const description = meta?.description || tpl?.description || ''
        const theme = tpl?.theme || meta?.theme || ''

        // story with optional {{word}} expansion
        let story = description
        if (story && wordAttr) story = story.replace(/\{\{word\}\}/gi, wordAttr)

        return {
          id,
          tokenURI: uri || '',
          name,
          description,
          image,
          theme,
          parts,
          word: wordAttr || '',
          story: story || '',
        }
      } catch {
        return { id }
      }
    })

    clearTimeout(timeout)
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, items })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
}
