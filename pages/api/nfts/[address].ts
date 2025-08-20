import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const EXTRA_RPCS = (process.env.NEXT_PUBLIC_BASE_RPCS || '')
  .split(',').map(s => s.trim()).filter(Boolean)
const NFT_ADDRESS = process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS || '0xCA699Fb766E3FaF36AC31196fb4bd7184769DD20'

// Optional: Alchemy / Reservoir keys
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || ''
const RESERVOIR_KEY = process.env.RESERVOIR_API_KEY || ''

const NFT_READ_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function templateOf(uint256 tokenId) view returns (string,string,string,string[],uint64,address)'
]

function makeProvider() {
  if (!EXTRA_RPCS.length) return new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true })
  const providers = [BASE_RPC, ...EXTRA_RPCS].map((u, i) => ({
    provider: new ethers.JsonRpcProvider(u, undefined, { staticNetwork: true }),
    stallTimeout: 900 + i * 200,
    priority: i, weight: 1
  }))
  return new ethers.FallbackProvider(providers, Math.max(1, Math.ceil(providers.length / 2)))
}

const sleep = (ms:number) => new Promise(r=>setTimeout(r,ms))
async function withRetry<T>(fn:()=>Promise<T>, tries=6) {
  let last: any
  for (let i=0;i<tries;i++) {
    try { return await fn() } catch (e) {
      last = e; await sleep(180 * Math.pow(1.8,i) + Math.random()*120)
    }
  }
  throw last
}

async function fetchFromAlchemy(owner: string) {
  if (!ALCHEMY_KEY) return null
  const url = `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${owner}&contractAddresses[]=${NFT_ADDRESS}&withMetadata=true`
  const r = await fetch(url)
  if (!r.ok) return null
  const j = await r.json()
  const items = (j.ownedNfts || []).map((n: any) => {
    const id = Number(n.tokenId)
    const meta = n.raw?.metadata || n.metadata || {}
    return {
      id,
      tokenURI: n.tokenUri?.raw || n.tokenUri?.gateway || '',
      image: meta.image || meta.image_url || '',
      name: meta.name || '',
      desc: meta.description || '',
      attributes: meta.attributes || []
    }
  })
  return items
}

async function fetchFromReservoir(owner: string) {
  if (!RESERVOIR_KEY) return null
  const url = `https://api.reservoir.tools/users/${owner}/tokens/v7?contracts=${NFT_ADDRESS}&limit=200`
  const r = await fetch(url, { headers: { 'x-api-key': RESERVOIR_KEY } })
  if (!r.ok) return null
  const j = await r.json()
  const items = (j.tokens || []).map((t: any) => {
    const id = Number(t?.token?.tokenId)
    const meta = t?.token?.metadata || {}
    return {
      id,
      tokenURI: t?.token?.tokenUri || '',
      image: meta.image || meta.image_url || '',
      name: meta.name || '',
      desc: meta.description || '',
      attributes: meta.attributes || []
    }
  })
  return items
}

async function onchainFallback(owner: string) {
  const provider = makeProvider()
  const nft = new ethers.Contract(NFT_ADDRESS, NFT_READ_ABI, provider)

  const bal = Number(await withRetry(() => nft.balanceOf(owner)).catch(()=>0n))
  if (!bal) return []

  let tokenIds: number[] = []
  // try enumerable
  for (let i=0;i<bal;i++) {
    try {
      const id = await withRetry(()=>nft.tokenOfOwnerByIndex(owner, i), 3)
      tokenIds.push(Number(id))
    } catch { tokenIds = []; break }
  }
  // fallback scan if needed
  if (!tokenIds.length) {
    const total = Number(await withRetry(()=>nft.totalSupply()).catch(()=>0n))
    const cap = Math.min(total || 0, 400)
    for (let t=1;t<=cap;t++) {
      const who = await withRetry(()=>nft.ownerOf(t), 2).catch(()=>null)
      if (who && who.toLowerCase() === owner.toLowerCase()) tokenIds.push(t)
    }
  }

  tokenIds = Array.from(new Set(tokenIds)).sort((a,b)=>a-b)

  const items = await Promise.all(tokenIds.map(async (id) => {
    const [uri, tpl] = await Promise.all([
      withRetry(()=>nft.tokenURI(id), 4).catch(()=> ''),
      withRetry(()=>nft.templateOf(id), 4).catch(()=> null),
    ])
    let meta: any = null
    try {
      if (uri?.startsWith('data:')) {
        const [,payload] = uri.split(',',2)
        meta = JSON.parse(decodeURIComponent(payload))
      } else if (uri) {
        const r = await fetch(uri.replace(/^ipfs:\/\//,'https://ipfs.io/ipfs/'))
        if (r.ok) meta = await r.json()
      }
    } catch {}

    const image = meta?.image || meta?.image_url || ''
    const name = meta?.name || (tpl?.[0] ?? `Template #${id}`)
    const desc = meta?.description || (tpl?.[1] ?? '')

    return {
      id,
      tokenURI: uri || '',
      image,
      name,
      desc,
      parts: Array.isArray(tpl?.[3]) ? tpl[3].map(String) : [],
      theme: tpl?.[2] || '',
      author: tpl?.[5] || ''
    }
  }))

  return items
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { address } = req.query
  const owner = String(address || '').toLowerCase()
  if (!owner || !owner.startsWith('0x')) return res.status(400).json({ error: 'bad address' })

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600')

  // 1) indexer
  let items = (await fetchFromAlchemy(owner)) || (await fetchFromReservoir(owner)) || null

  // 2) on-chain fallback or merge
  if (!items || !items.length) {
    items = await onchainFallback(owner)
  } else {
    // enrich each with on-chain templateOf (batched-ish)
    try {
      const provider = makeProvider()
      const nft = new ethers.Contract(NFT_ADDRESS, NFT_READ_ABI, provider)
      await Promise.all(items.map(async (it) => {
        try {
          const tpl = await withRetry(()=>nft.templateOf(it.id), 3)
          it.parts  = Array.isArray(tpl?.[3]) ? tpl[3].map(String) : it.parts || []
          it.theme  = tpl?.[2] || it.theme || ''
          it.author = tpl?.[5] || it.author || ''
        } catch {}
      }))
    } catch {}
  }

  // normalize ipfs images
  items = (items || []).map((it:any) => ({
    ...it,
    image: it.image?.startsWith('ipfs://')
      ? `https://ipfs.io/ipfs/${it.image.slice(7)}`
      : it.image || ''
  }))

  return res.status(200).json({ items })
}
