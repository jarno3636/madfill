// components/Layout.jsx
'use client'

import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import WalletConnectButton from '@/components/WalletConnectButton'

// load mini-app wallet button only on client
const MiniConnectButton = dynamic(
  () => import('@/components/MiniConnectButton'),
  { ssr: false }
)

export default function Layout({ children }) {
  const [open, setOpen] = useState(false)

  const NavLink = ({ href, children }) => (
    <Link
      href={href}
      className="text-slate-200 hover:text-indigo-300 transition"
      onClick={() => setOpen(false)}
    >
      {children}
    </Link>
  )

  return (
    <div className="bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 min-h-screen text-white">
      {/* ---- Farcaster Mini App + basic OG/Twitter ---- */}
      <Head>
        {/* Key flag so Warpcast opens this as a Mini App */}
        <meta name="fc:frame" content="vNext" />

        {/* Nice to have defaults; pages can override with their SEO component */}
        <meta property="og:title" content="MadFill — Fill the blank, win the pot." />
        <meta property="og:description" content="MadFill on Base. Create rounds, drop one word, vote, and win." />
        <meta property="og:image" content="https://madfill.vercel.app/og/cover.png" />
        <meta property="og:url" content="https://madfill.vercel.app" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="canonical" href="https://madfill.vercel.app" />
      </Head>

      <nav className="sticky top-0 z-40 backdrop-blur bg-slate-950/90 border-b border-indigo-700">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-extrabold tracking-tight hover:text-indigo-300">
            🧠 MadFill
          </Link>

          <div className="hidden md:flex items-center gap-5 text-sm">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/active">Active Rounds</NavLink>
            <NavLink href="/vote">Community Vote</NavLink>
            <NavLink href="/myo">🎨 Make Your Own</NavLink>
            <NavLink href="/free">🎁 Free Game</NavLink>
            <NavLink href="/myrounds">My Rounds</NavLink>
          </div>

          <div className="flex items-center gap-2">
            {/* Warpcast mini-app wallet (in-app) */}
            <MiniConnectButton />
            {/* Regular browser wallet (injected / WC) */}
            <WalletConnectButton />

            <button
              className="md:hidden px-3 py-1.5 border border-slate-700 rounded-lg"
              onClick={() => setOpen(v => !v)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950/95">
            <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3 text-sm">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/active">Active Rounds</NavLink>
              <NavLink href="/vote">Community Vote</NavLink>
              <NavLink href="/myo">🎨 Make Your Own</NavLink>
              <NavLink href="/free">🎁 Free Game</NavLink>
              <NavLink href="/myrounds">My Rounds</NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Helpful hint when inside Warpcast and no injected wallet is present */}
      {typeof navigator !== 'undefined' &&
        /Warpcast/i.test(navigator.userAgent) &&
        typeof window !== 'undefined' &&
        !window.ethereum && (
          <div className="mx-auto max-w-6xl px-4 pt-3 text-xs text-amber-300">
            Tip: In Warpcast, use the “Connect (Warpcast)” button. If you need an injected wallet,
            open in your browser instead.
          </div>
        )
      }

      <main className="max-w-6xl mx-auto p-4 md:p-6">{children}</main>
    </div>
  )
}
