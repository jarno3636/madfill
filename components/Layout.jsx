'use client'

import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useState, useCallback } from 'react'
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
      className={`px-2 py-1 rounded-lg transition-colors
        ${isActive
          ? 'text-indigo-300 bg-slate-800/60'
          : 'text-slate-200 hover:text-indigo-300 hover:bg-slate-800/40'
        }`}
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}

export default function Layout({ children }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // close on route change (so sheet collapses after nav)
  useEffect(() => {
    const handle = () => setOpen(false)
    router.events?.on?.('routeChangeStart', handle)
    return () => router.events?.off?.('routeChangeStart', handle)
  }, [router.events])

  // lock body scroll when sheet open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  // close on ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const navItems = useMemo(
    () => [
      { href: '/', label: '🏠 Home' },
      { href: '/active', label: '🏆 Active Rounds' },
      { href: '/vote', label: '🗳️ Community Vote' },
      { href: '/myo', label: '🎨 Make Your Own' },
      { href: '/free', label: '🎁 Free Play' },
      { href: '/challenge', label: '⚔️ Challenge' },
      { href: '/myrounds', label: '📜 My Rounds' },
    ],
    []
  )

  // split nav into two columns for the mobile sheet
  const splitNav = useCallback((arr) => {
    const mid = Math.ceil(arr.length / 2)
    return [arr.slice(0, mid), arr.slice(mid)]
  }, [])
  const [colA, colB] = splitNav(navItems)

  return (
    <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 min-h-screen text-white flex flex-col">
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

      {/* Top Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-slate-950/70 bg-slate-950/90 border-b border-indigo-800/50">
        <div className="mx-auto max-w-6xl px-4 py-3.5 flex items-center justify-between gap-3">
          {/* Brand */}
          <Link href="/" className="group inline-flex items-center gap-2">
            <span className="text-2xl leading-none">🧠</span>
            <span className="text-xl font-extrabold tracking-tight group-hover:text-indigo-300 transition-colors">
              MadFill
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            {navItems.map(({ href, label }) => (
              <NavLink key={href} href={href}>
                {label}
              </NavLink>
            ))}
          </div>

          {/* Desktop wallet */}
          <div className="hidden md:flex items-center gap-2">
            <MiniConnectButton />
            <WalletConnectButton />
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen(true)}
            className="md:hidden inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-700 rounded-xl bg-slate-900/70 hover:bg-slate-900/60 text-slate-200"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="font-medium tracking-wide">Menu</span>
          </button>
        </div>
      </nav>

      {/* Mobile Sheet (split layout, shorter, buttons centered at bottom) */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Backdrop */}
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div className="absolute inset-x-0 top-0 mx-auto max-w-lg rounded-b-3xl overflow-hidden shadow-2xl ring-1 ring-indigo-500/20">
            <div className="bg-gradient-to-b from-slate-950/95 to-slate-900/95">
              {/* Header row */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div className="inline-flex items-center gap-2">
                  <span className="text-xl">🧠</span>
                  <span className="font-bold">MadFill</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-200"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Split grid of links */}
              <div className="px-4 py-3">
                <div className="grid grid-cols-2 gap-2">
                  {/* Column A */}
                  <div className="flex flex-col gap-1.5">
                    {colA.map(({ href, label }) => (
                      <NavLink key={href} href={href} onClick={() => setOpen(false)}>
                        {label}
                      </NavLink>
                    ))}
                  </div>
                  {/* Column B */}
                  <div className="flex flex-col gap-1.5">
                    {colB.map(({ href, label }) => (
                      <NavLink key={href} href={href} onClick={() => setOpen(false)}>
                        {label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom actions — centered */}
              <div className="px-4 pb-4 pt-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <MiniConnectButton />
                    <WalletConnectButton />
                  </div>
                </div>
                <div className="pt-3 text-center text-[11px] text-slate-400">
                  Built on Base • MadFill
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-4 py-8 flex-grow">{children}</main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/60">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/challenge" className="underline decoration-dotted hover:text-indigo-300">Start a Challenge</Link>
            <Link href="/active" className="underline decoration-dotted hover:text-indigo-300">Active Rounds</Link>
            <Link href="/vote" className="underline decoration-dotted hover:text-indigo-300">Community Vote</Link>
          </div>
          <div className="opacity-80">© {new Date().getFullYear()} MadFill</div>
        </div>
      </footer>
    </div>
  )
}
