// components/Layout.jsx
'use client'

import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import dynamic from 'next/dynamic'

// Load wallet buttons only on the client to avoid SSR "self is not defined"
const MiniConnectButton = dynamic(() => import('./MiniConnectButton'), { ssr: false })
const WalletConnectButton = dynamic(() => import('./WalletConnectButton'), { ssr: false })

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
      {/* Default meta (kept simple/SSR-safe) */}
      <Head>
        <meta name="fc:frame" content="vNext" />
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
          {/* Logo / Home */}
          <Link href="/" className="text-2xl font-extrabold tracking-tight hover:text-indigo-300">
            🧠 MadFill
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-5 text-sm">
            <NavLink href="/">🏠 Home</NavLink>
            <NavLink href="/active">🏆 Active Rounds</NavLink>
            <NavLink href="/vote">🗳️ Community Vote</NavLink>
            <NavLink href="/myo">🎨 Make Your Own</NavLink>
            <NavLink href="/free">🎁 Free Play</NavLink>
            <NavLink href="/challenge">⚔️ Challenge</NavLink>
            <NavLink href="/myrounds">📜 My Rounds</NavLink>
            <NavLink href="/leaderboard">📈 Leaderboard</NavLink>
            <NavLink href="/profile">👤 Profile</NavLink>
          </div>

          {/* Wallets (desktop) */}
          <div className="hidden md:flex items-center gap-2">
            <MiniConnectButton />
            <WalletConnectButton />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(v => !v)}
            className="md:hidden inline-flex items-center gap-2 px-3.5 py-2.5 text-sm border border-slate-700 rounded-xl bg-slate-900/70 hover:bg-slate-900/60 text-slate-200"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="font-medium tracking-wide">Menu</span>
          </button>
        </div>

        {/* Mobile Nav Drawer */}
        {open && (
          <div className="md:hidden bg-slate-900/95 border-t border-indigo-700">
            <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-3 text-sm">
              <NavLink href="/">🏠 Home</NavLink>
              <NavLink href="/active">🏆 Active Rounds</NavLink>
              <NavLink href="/vote">🗳️ Community Vote</NavLink>
              <NavLink href="/myo">🎨 Make Your Own</NavLink>
              <NavLink href="/free">🎁 Free Play</NavLink>
              <NavLink href="/challenge">⚔️ Challenge</NavLink>
              <NavLink href="/myrounds">📜 My Rounds</NavLink>
              <NavLink href="/leaderboard">📈 Leaderboard</NavLink>
              <NavLink href="/profile">👤 Profile</NavLink>

              {/* Wallets (mobile) */}
              <div className="pt-3 flex flex-col gap-2">
                <MiniConnectButton />
                <WalletConnectButton />
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
