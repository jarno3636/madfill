// components/Layout.jsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/router'
import ConnectBar from '@/components/ConnectBar'

export default function Layout({ children }) {
  const router = useRouter()
  const isActive = (href) => router.pathname === href

  const navLink = (href, label, extra = '') => (
    <Link
      href={href}
      className={[
        'hover:text-indigo-300 transition',
        isActive(href) ? 'text-indigo-300' : 'text-slate-200',
        extra,
      ].join(' ')}
    >
      {label}
    </Link>
  )

  return (
    <div className="bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 min-h-screen text-white relative">
      {/* Navbar */}
      <nav className="flex flex-wrap justify-between items-center p-6 shadow-xl bg-slate-950/90 border-b border-indigo-700 gap-y-2 sticky top-0 z-40 backdrop-blur">
        <h1 className="text-2xl font-extrabold tracking-tight cursor-pointer hover:text-indigo-300 transition drop-shadow-md">
          <Link href="/">🧠 MadFill</Link>
        </h1>

        <div className="flex flex-wrap gap-4 items-center text-sm font-medium">
          {navLink('/', 'Home')}
          {navLink('/active', 'Active Rounds')}
          {navLink('/vote', 'Community Vote')}
          {navLink('/myrounds', '🏆 My Rounds', 'font-semibold')}
          {navLink('/myo', '🎨 Make Your Own', 'font-semibold')}
          {navLink('/free', '🎁 Free Game', 'font-semibold')}
        </div>

        {/* Wallet connect / address / switch-to-Base */}
        <ConnectBar />
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {children}
      </main>
    </div>
  )
}
