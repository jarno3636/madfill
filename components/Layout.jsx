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
      className="text-slate-200 hover:text-indigo-300 transition"
      onClick={() => setOpen(false)}
    >
      {children}
    </Link>
  )

  return (
    <div className="bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 min-h-screen text-white">
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
          </div>

          <div className="flex items-center gap-2">
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
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-6">{children}</main>
    </div>
  )
}
