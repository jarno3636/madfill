// pages/free.jsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useWindowSize } from 'react-use'

import Layout from '@/components/Layout'
import SEO from '@/components/SEO'
import ShareBar from '@/components/ShareBar'
import StyledCard from '@/components/StyledCard'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { categories } from '@/data/templates'
import { fetchFarcasterProfile } from '@/lib/neynar'
import { absoluteUrl, buildOgUrl } from '@/lib/seo'
import { useMiniAppReady } from '@/hooks/useMiniAppReady'

const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

/* ---------- helpers ---------- */
function sanitizeWord(raw) {
  return (raw || '')
    .trim()
    .split(' ')[0]
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    .slice(0, 16)
}
function parseWordsParam(param, blanks) {
  if (!param) return {}
  const arr = String(param)
    .split(',')
    .map((w) => sanitizeWord(decodeURIComponent(w)))
  const obj = {}
  for (let i = 0; i < Math.min(arr.length, blanks); i++) obj[i] = arr[i]
  return obj
}
function buildWordsParam(words, blanks) {
  const list = []
  for (let i = 0; i < blanks; i++) list.push(encodeURIComponent(sanitizeWord(words[i] || '')))
  return list.join(',')
}

export default function FreeGame() {
  useMiniAppReady()

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [words, setWords] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [profile, setProfile] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [copied, setCopied] = useState(false)
  const { width, height } = useWindowSize()

  const category = categories[catIdx] || { name: 'General', templates: [] }
  const template = category.templates[tplIdx] || { parts: [], blanks: 0, name: 'Untitled' }

  /* load optional farcaster profile */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (typeof window === 'undefined') return
        const fid = localStorage.getItem('fc_fid')
        if (!fid) return
        const p = await fetchFarcasterProfile(fid)
        if (!cancelled) setProfile(p)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  /* init from url */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const u = new URL(window.location.href)
    const c = Number(u.searchParams.get('c') || '0')
    const safeCat = Number.isFinite(c) ? Math.max(0, Math.min(categories.length - 1, c)) : 0

    const tRaw = Number(u.searchParams.get('t') || '0')
    const tplLen = categories[safeCat]?.templates.length || 1
    const safeTpl = Number.isFinite(tRaw) ? Math.max(0, Math.min(tplLen - 1, tRaw)) : 0

    setCatIdx(safeCat)
    setTplIdx(safeTpl)

    const blanks = categories[safeCat]?.templates?.[safeTpl]?.blanks || 0
    const wordsParam = u.searchParams.get('w') || ''
    setWords(parseWordsParam(wordsParam, blanks))
  }, [])

  /* keep url in sync */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const blanks = template.blanks
    const u = new URL(window.location.href)
    u.searchParams.set('c', String(catIdx))
    u.searchParams.set('t', String(tplIdx))
    u.searchParams.set('w', buildWordsParam(words, blanks))
    window.history.replaceState({}, '', u.toString())
  }, [catIdx, tplIdx, words, template.blanks])

  const allWordsFilled = useMemo(
    () => Array.from({ length: template.blanks }).every((_, i) => !!sanitizeWord(words[i])),
    [template.blanks, words]
  )

  const filledText = useMemo(() => {
    const out = []
    for (let i = 0; i < template.parts.length; i++) {
      out.push(template.parts[i] || '')
      if (i < template.blanks) out.push(sanitizeWord(words[i] || '____'))
    }
    return out.join('')
  }, [template, words])

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app')

  const permalink = useMemo(() => {
    if (typeof window === 'undefined') return `${origin}/free`
    return window.location.href
  }, [origin, catIdx, tplIdx, words, template.blanks])

  const shareText = `I just played the Free MadFill Game!\n\n${filledText}\n\nPlay free:`

  const pageUrl = absoluteUrl('/free')
  const ogImage = useMemo(
    () =>
      buildOgUrl({
        screen: 'free',
        c: String(catIdx),
        t: String(tplIdx),
        w: buildWordsParam(words, template.blanks),
        title: 'Free MadFill',
      }),
    [catIdx, tplIdx, words, template.blanks]
  )

  function handleWordChange(i, val) {
    setWords((w) => ({ ...w, [i]: sanitizeWord(val) }))
  }
  function handleSubmit() {
    setSubmitted(true)
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 1800)
  }
  function handleRemix() {
    setSubmitted(false)
  }
  function surpriseMe() {
    const tokens = ['neon', 'taco', 'llama', 'vibe', 'sprocket', 'laser', 'bop', 'glow', 'noodle', 'vortex', 'biscuit', 'snack', 'jazz', 'pixel', 'dino', 'meta']
    const next = {}
    for (let i = 0; i < template.blanks; i++) next[i] = tokens[(Math.random() * tokens.length) | 0]
    setWords(next)
  }
  function randomTemplate() {
    const c = (Math.random() * categories.length) | 0
    const tCount = categories[c]?.templates.length || 1
    const t = (Math.random() * tCount) | 0
    setCatIdx(c)
    setTplIdx(t)
    setWords({})
    setSubmitted(false)
  }
  async function copyToClipboard() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(filledText)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch {}
  }

  return (
    <Layout>
      <Head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={ogImage} />
        <meta property="fc:frame:button:1" content="Play Free" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={permalink || pageUrl} />
        <link rel="canonical" href={permalink || pageUrl} />
      </Head>

      <SEO
        title="Free Game — MadFill"
        description="Create, laugh, and share your own fill-in-the-blank card. No wallet needed!"
        url={permalink || pageUrl}
        image={ogImage}
        type="website"
        twitterCard="summary_large_image"
      />

      {showConfetti && width > 0 && height > 0 && <Confetti width={width} height={height} />}

      <main className="mx-auto w-full max-w-5xl px-4 md:px-6 py-6 text-white space-y-6">
        {/* Banner */}
        <div className="rounded-2xl bg-gradient-to-br from-pink-700 via-indigo-700 to-cyan-700 p-6 md:p-8 shadow-xl ring-1 ring-white/10">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">🎁 Free MadFill</h1>
          <p className="text-indigo-100 mt-2 max-w-2xl">
            No wallet, no gas, just vibes. Fill in the blanks, get a sharable card, and challenge your friends.
          </p>
        </div>

        {/* Builder */}
        <Card className="bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700 w-full">
          <CardHeader className="border-b border-slate-700 bg-slate-800/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-xl font-bold flex-1 min-w-0">Build your card</h2>

              <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
                <Button onClick={randomTemplate} className="bg-slate-700 hover:bg-slate-600" type="button">
                  🎲 Random template
                </Button>
                <Button onClick={surpriseMe} className="bg-fuchsia-700 hover:bg-fuchsia-600" type="button">
                  🪄 Surprise me
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            {/* Pickers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block text-sm text-slate-300">
                Category
                <select
                  className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  value={catIdx}
                  onChange={(e) => {
                    setCatIdx(+e.target.value)
                    setTplIdx(0)
                    setWords({})
                    setSubmitted(false)
                  }}
                >
                  {categories.map((c, i) => (
                    <option key={i} value={i}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300 md:col-span-2">
                Template
                <select
                  className="mt-1 w-full rounded-lg bg-slate-800/70 border border-slate-700 px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  value={tplIdx}
                  onChange={(e) => {
                    setTplIdx(+e.target.value)
                    setWords({})
                    setSubmitted(false)
                  }}
                >
                  {category.templates.map((t, i) => (
                    <option key={i} value={i}>{t.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Inputs */}
            <div className="space-y-2">
              {Array.from({ length: template.blanks }).map((_, i) => {
                const val = words[i] || ''
                const ok = val.length > 0
                return (
                  <div key={i}>
                    <label className="text-sm text-slate-300">
                      Word {i + 1} (one word, a–z 0–9 _ -, max 16)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., neon"
                      className={`mt-1 w-full rounded-lg bg-slate-800/70 border px-3 py-2 outline-none focus:ring-2 ${
                        ok ? 'border-slate-700 focus:ring-indigo-400' : 'border-red-600/60 focus:ring-red-500/50'
                      }`}
                      value={val}
                      onChange={(e) => handleWordChange(i, e.target.value)}
                      inputMode="latin"
                      autoCapitalize="off"
                      autoCorrect="off"
                    />
                    <div className="text-xs mt-1 text-slate-400">{val.length}/16</div>
                  </div>
                )
              })}
            </div>

            {/* Preview */}
            <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 space-y-3 overflow-hidden">
              <div className="text-slate-300 text-sm">Live preview</div>

              {/* prevent overflow + keep centered */}
              <div className="max-w-full overflow-hidden">
                <StyledCard
                  parts={template.parts}
                  blanks={template.blanks}
                  words={words}
                  className="max-w-full break-words"
                />
              </div>

              {allWordsFilled && (
                <div>
                  <Button
                    onClick={copyToClipboard}
                    className="bg-slate-700 hover:bg-slate-600 w-full"
                    type="button"
                  >
                    {copied ? '✅ Copied!' : '📋 Copy text'}
                  </Button>
                </div>
              )}
            </div>

            {/* CTA */}
            {!submitted ? (
              <Button
                onClick={handleSubmit}
                className="bg-pink-600 hover:bg-pink-500 w-full"
                disabled={!allWordsFilled}
              >
                🎉 Submit & View Your Card
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-slate-800/70 border border-pink-500 p-3">
                  <div className="font-semibold">Your completed card</div>
                  <div className="text-sm text-slate-300 mt-1">
                    Save the link or share below — anyone can open this page and see your exact card.
                  </div>
                  {profile && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-yellow-200">
                      <img
                        src={profile.pfp_url || '/Capitalize.PNG'}
                        alt="Avatar"
                        className="w-6 h-6 rounded-full border border-white"
                        onError={(e) => { e.currentTarget.src = '/Capitalize.PNG' }}
                      />
                      <span>Shared by @{profile.username}</span>
                    </div>
                  )}
                </div>

                <ShareBar
                  url={permalink}
                  text={shareText}
                  embedUrl={permalink}
                  og={{
                    screen: 'free',
                    c: String(catIdx),
                    t: String(tplIdx),
                    w: buildWordsParam(words, template.blanks),
                    title: 'Free MadFill'
                  }}
                />

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleRemix} className="bg-slate-700 hover:bg-slate-600" type="button">
                    🔁 Remix this card
                  </Button>
                  <Button
                    onClick={() => { setWords({}); setSubmitted(false) }}
                    className="bg-slate-700 hover:bg-slate-600"
                    type="button"
                  >
                    ♻️ Start over
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  )
}
