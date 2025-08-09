// components/Layout.jsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import WalletConnectButton from '@/components/WalletConnectButton'

export default function Layout({ children }) {
  const [open, setOpen] = useState(false)

  const NavLink = ({ href, children }) => (
    <Link
      href={href}
      className="px-2 py-1 rounded-lg text-slate-200 hover:text-white hover:bg-indigo-600/20 transition-colors"
      onClick={() => setOpen(false)}
    >
      {children}
    </Link>
  )

  return (
    <div className="bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 min-h-screen text-white">
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-slate-950/80 border-b border-indigo-700 shadow-md">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          {/* Logo / Brand */}
          <Link
            href="/"
            className="text-2xl font-extrabold tracking-tight hover:text-indigo-300 flex items-center gap-2"
          >
            🧠 <span>MadFill</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-5 text-sm font-medium">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/active">Active Rounds</NavLink>
            <NavLink href="/vote">Community Vote</NavLink>
            <NavLink href="/myo">🎨 Make Your Own</NavLink>
            <NavLink href="/free">🎁 Free Game</NavLink>
          </div>

          {/* Wallet + Menu Toggle */}
          <div className="flex items-center gap-3">
            <WalletConnectButton />
            <button
              className="md:hidden px-3 py-2 border border-slate-700 rounded-lg hover:border-indigo-500 transition-colors"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {open && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950/95 animate-slideDown">
            <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2 text-sm font-medium">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/active">Active Rounds</NavLink>
              <NavLink href="/vote">Community Vote</NavLink>
              <NavLink href="/myo">🎨 Make Your Own</NavLink>
              <NavLink href="/free">🎁 Free Game</NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Page Content */}
      <main className="max-w-6xl mx-auto p-4 md:p-6">{children}</main>
    </div>
  )
}
