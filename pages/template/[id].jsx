// pages/template/[id].jsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ethers } from 'ethers'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useTx } from '@/components/TxProvider'

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

function HighlightBlanks({ text }) {
  if (!text) return null
  const segs = String(text).split('____')
  return (
    <span>
      {segs.map((s, i) => (
        <span key={i}>
          <span className="text-slate-100">{s}</span>
          {i < segs.length - 1 && (
            <span className="px-1 rounded-md bg-slate-700/70 text-amber-300 font-semibold align-baseline">____</span>
          )}
        </span>
      ))}
    </span>
  )
}

export default function TemplateDetail() {
  const router = useRouter()
  const id = Number(router.query.id)
  const { BASE_RPC, NFT_ADDRESS } = useTx()

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tpl, setTpl] = useState(null)

  const pageUrl = useMemo(() => absoluteUrl(`/template/${id || ''}`), [id])
  const ogImage = useMemo(
    () => buildOgUrl({ screen: 'template', token: id, title: tpl?.title || `Template #${id}` }),
    [id, tpl?.title]
  )

  useEffect(() => {
    if (!id || !NFT_ADDRESS) return
    ;(async () => {
      setLoading(true); setErr('')
      try {
        const abi = [
          'function templateOf(uint256 tokenId) view returns (string title, string description, string theme, string[] parts, uint64 createdAt, address author)',
          'function tokenURI(uint256 tokenId) view returns (string)',
        ]
        const provider = new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true })
        const nft = new ethers.Contract(NFT_ADDRESS, abi, provider)
        const res = await nft.templateOf(BigInt(id))
        const data = {
          title: String(res?.[0] ?? `Template #${id}`),
          description: String(res?.[1] ?? ''),
          theme: String(res?.[2] ?? ''),
          parts: Array.isArray(res?.[3]) ? res[3].map(String) : [],
          createdAt: Number(res?.[4] ?? 0),
          author: String(res?.[5] ?? ''),
        }
        setTpl(data)
      } catch (e) {
        console.error(e)
        setErr('Failed to load template.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, BASE_RPC, NFT_ADDRESS])

  const templateLine = useMemo(() => buildTemplateLine(tpl?.parts || []), [tpl])

  return (
    <>
      <Head>
        <title>{tpl?.title || `Template #${id}`} — MadFill</title>
        <meta name="description" content={tpl?.description || templateLine || 'MadFill template'} />
        <meta property="og:title" content={tpl?.title || `Template #${id}`} />
        <meta property="og:description" content={templateLine || tpl?.description || ''} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={pageUrl} />
        <meta property="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-extrabold">{tpl?.title || `Template #${id}`}</h1>
          {tpl?.theme && <div className="mt-1 text-slate-300 text-sm">Theme: {tpl.theme}</div>}

          <div className="mt-5 rounded-2xl bg-slate-900/70 border border-slate-700 p-5">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Template</div>
            <div className="mt-2 text-lg leading-relaxed">
              {loading ? 'Loading…' : err ? <span className="text-rose-300">{err}</span> : <HighlightBlanks text={templateLine} />}
            </div>
            {tpl?.description && (
              <div className="mt-4 text-sm text-slate-300 leading-relaxed">{tpl.description}</div>
            )}
          </div>

          <div className="mt-6 text-xs text-slate-400">
            Shareable URL: <span className="underline break-all">{pageUrl}</span>
          </div>
        </div>
      </main>
    </>
  )
}
