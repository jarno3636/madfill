'use client'

import Head from 'next/head'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'

// Wallet buttons loaded client-side only
const MiniConnectButton = dynamic(() => import('./MiniConnectButton'), { ssr: false })
const WalletConnectButton = dynamic(() => import('./WalletConnectButton'), { ssr: false })

// Mini App SDK "ready" ping (client-only)
const AppReady = dynamic(() => import('./AppReady'), { ssr: false })

function NavLink({ href, children, onClick }) {
  const router = useRouter()
  const isActive = router.pathname === href
  return (
    <Link
      href={href}
      className={`text-slate-200 hover:text-indigo-300 transition ${
        isActive ? 'font-semibold text-indigo-300' : ''
      }`}
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}

export default function Layout({ children }) {
  const [open, setOpen] = useState(false)
  const closeMenu = () => setOpen(false)

  const navItems = useMemo(
    () => [
      { href: '/', label: '🏠 Home' },
      { href: '/active', label: '🏆 Active Rounds' },
      { href: '/vote', label: '🗳️ Community Vote' },
      { href: '/myo', label: '🎨 Make Your Own' },
      { href: '/free', label: '🎁 Free Play' },
      { href: '/challenge', label: '⚔️ Challenge' },
      { href: '/myrounds', label: '📜 My Rounds' }
    ],
    []
  )

  return (
    <div className="bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 min-h-screen text-white flex flex-col">
      {/* Farcaster Mini App: signal UI is ready (no-op on web) */}
      <AppReady />

      <Head>
        <meta name="fc:frame" content="vNext" />
        <meta property="og:title" content="MadFill — Fill the blank, win the pot." />
        <meta property="og:description" content="MadFill on Base. Create rounds, drop one word, vote, and win." />
        <meta property="og:image" content="https://madfill.vercel.app/og/cover.PNG" />
        <meta property="og:url" content="https://madfill.vercel.app" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="canonical" href="https://madfill.vercel.app" />

        {/* Helpful mobile / mini-app meta tweaks */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0b1020" />
      </Head>

      <nav className="sticky top-0 z-40 backdrop-blur bg-slate-950/90 border-b border-indigo-700">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-extrabold tracking-tight hover:text-indigo-300">
            🧠 MadFill
          </Link>

          <div className="hidden md:flex items-center gap-5 text-sm">
            {navItems.map(({ href, label }) => (
              <NavLink key={href} href={href}>
                {label}
              </NavLink>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <MiniConnectButton />
            <WalletConnectButton />
          </div>

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

        {open && (
          <div className="md:hidden bg-slate-900/95 border-t border-indigo-700">
            <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-3 text-sm">
              {navItems.map(({ href, label }) => (
                <NavLink key={href} href={href} onClick={closeMenu}>
                  {label}
                </NavLink>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <MiniConnectButton />
                <WalletConnectButton />
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 flex-grow">{children}</main>
    </div>
  )
}
