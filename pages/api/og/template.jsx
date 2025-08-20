// pages/api/og/template.jsx
/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from '@vercel/og'
import { ethers } from 'ethers'

export const config = { runtime: 'edge' }

/* ---------- chain config ---------- */
const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC ||
  process.env.BASE_RPC ||
  'https://mainnet.base.org'

const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS ||
  process.env.NFT_TEMPLATE_ADDRESS ||
  '0xCA699Fb766E3FaF36AC31196fb4bd7184769DD20'

/* ---------- helpers ---------- */
const needsSpaceBefore = (str) => !!str && !/\s|[.,!?;:)"'\]]/.test(str[0])

function buildTemplateLine(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return ''
  const out = []
  for (let i = 0; i < parts.length; i++) {
    out.push(String(parts[i] ?? ''))
    if (i < parts.length - 1) out.push('____')
  }
  return out.join('')
}

function highlightChildren(str) {
  // Split by `____` to draw blank chips
  const segs = String(str).split('____')
  const nodes = []
  segs.forEach((s, i) => {
    nodes.push(
      <span key={`t${i}`} style={{ color: '#E5E7EB' /* slate-200 */ }}>{s}</span>
    )
    if (i < segs.length - 1) {
      nodes.push(
        <span
          key={`b${i}`}
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            background: 'rgba(148,163,184,0.22)', // slate-400/20
            color: '#FCD34D', // amber-300
            borderRadius: 8,
            fontWeight: 700,
            margin: '0 6px',
          }}
        >
          ____
        </span>
      )
    }
  })
  return nodes
}

/* ---------- API ---------- */
export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url)
    const idParam = searchParams.get('id')
    if (!idParam) {
      return new Response('Missing id', { status: 400 })
    }
    const id = BigInt(idParam)

    // on-chain read
    const abi = [
      'function templateOf(uint256 tokenId) view returns (string title, string description, string theme, string[] parts, uint64 createdAt, address author)'
    ]
    const provider = new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true })
    const nft = new ethers.Contract(NFT_ADDRESS, abi, provider)

    let title = `Template #${idParam}`
    let theme = ''
    let templateLine = ''

    try {
      const res = await nft.templateOf(id)
      title = String(res?.[0] ?? title)
      theme = String(res?.[2] ?? '')
      const parts = Array.isArray(res?.[3]) ? res[3].map(String) : []
      templateLine = buildTemplateLine(parts)
    } catch (e) {
      // fall back to minimal card
      console.warn('og/template: templateOf failed', e)
    }

    const width = 1200
    const height = 630

    return new ImageResponse(
      (
        <div
          style={{
            width, height,
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg,#0f172a 0%,#0b1220 60%,#111827 100%)', // slate-950 mix
            padding: 64,
            fontFamily: 'Inter, ui-sans-serif, system-ui',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg,#f472b6,#c084fc)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#0b1220', fontWeight: 800, fontSize: 26
              }}
            >
              🧠
            </div>
            <div style={{ marginLeft: 14, color: '#E5E7EB', fontSize: 24, fontWeight: 700 }}>
              MadFill Template
            </div>
          </div>

          {/* Title */}
          <div style={{ color: '#F1F5F9', fontSize: 48, fontWeight: 900, lineHeight: 1.1 }}>
            {title}
          </div>
          {theme ? (
            <div style={{ marginTop: 6, color: '#94A3B8', fontSize: 22 }}>Theme: {theme}</div>
          ) : null}

          {/* Body */}
          <div
            style={{
              marginTop: 28,
              padding: 28,
              borderRadius: 24,
              background: 'rgba(15,23,42,0.66)', // slate-900/70
              border: '1px solid rgba(51,65,85,0.9)', // slate-700
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ color: '#94A3B8', textTransform: 'uppercase', fontSize: 18, letterSpacing: 2 }}>
              Template
            </div>
            <div style={{ fontSize: 30, lineHeight: 1.4, display: 'flex', flexWrap: 'wrap' }}>
              {templateLine ? highlightChildren(templateLine) : (
                <span style={{ color: '#CBD5E1' }}>No on-chain parts found.</span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 'auto', color: '#94A3B8', fontSize: 20, display: 'flex', justifyContent: 'space-between' }}>
            <span>Built on Base</span>
            <span>madfill.xyz</span>
          </div>
        </div>
      ),
      {
        width,
        height,
        headers: {
          'Cache-Control': 'public, s-maxage=600, max-age=600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (e) {
    console.error(e)
    return new Response('OG error', { status: 500 })
  }
}
