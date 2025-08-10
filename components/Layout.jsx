// components/Layout.jsx
'use client'

import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import WalletConnectButton from '@/components/WalletConnectButton'

// Mini App wallet button only loads client-side
const MiniConnectButton = dynamic(() => import('@/components/MiniConnectButton'), { ssr: false })

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
      {/* Farcaster Mini App + default OG/Twitter meta */}
      <Head>
        {/* Warpcast Mini App flag */}
        <meta name="fc:frame" content="vNext" />

        {/* Default OG + Twitter tags */}
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
            MadFill
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex gap-6 items-center">
            <NavLink href="/active">Active Rounds</NavLink>
            <NavLink href="/free">Free Play</NavLink>
            <NavLink href="/myo">My Rounds</NavLink>
            <WalletConnectButton />
            <MiniConnectButton />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden text-slate-200 hover:text-indigo-300 focus:outline-none"
          >
            ☰
          </button>
        </div>

        {/* Mobile Nav Drawer */}
        {open && (
          <div className="md:hidden bg-slate-900 border-t border-indigo-700 flex flex-col gap-4 px-6 py-4">
            <NavLink href="/active">Active Rounds</NavLink>
            <NavLink href="/free">Free Play</NavLink>
            <NavLink href="/myo">My Rounds</NavLink>
            <WalletConnectButton />
            <MiniConnectButton />
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
