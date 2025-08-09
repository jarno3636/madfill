// components/Layout.jsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/router'
import WalletConnectButton from '@/components/WalletConnectButton'

export default function Layout({ children }) {
  const router = useRouter()
  const isActive = (href) => router.pathname === href
  const navLink = (href, label, extra = '') => (
    <Link
      href={href}
      className={`hover:text-indigo-300 transition ${
        isActive(href) ? 'text-indigo-300' : 'text-slate-200'
      } ${extra}`}
    >
      {label}
    </Link>
  )

  return (
    <div className="bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 min-h-screen text-white">
      {/* Navbar (wallet lives here now) */}
      <nav className="flex items-center justify-between p-6 shadow-xl bg-slate-950/90 border-b border-indigo-700 sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-extrabold tracking-tight hover:text-indigo-300 transition">
            <Link href="/">🧠 MadFill</Link>
          </h1>
          <div className="hidden md:flex items-center gap-4 text-sm font-medium">
            {navLink('/', 'Home')}
            {navLink('/active', 'Active Rounds')}
            {navLink('/vote', 'Community Vote')}
            {navLink('/myrounds', '🏆 My Rounds', 'font-semibold')}
            {navLink('/myo', '🎨 Make Your Own', 'font-semibold')}
            {navLink('/free', '🎁 Free Game', 'font-semibold')}
          </div>
        </div>

        {/* Wallet button (connect / address pill / menu) */}
        <WalletConnectButton buttonClassName="shadow-md" showNetworkPill />
      </nav>

      {/* Secondary nav for mobile */}
      <div className="md:hidden px-6 pt-2 pb-4 flex flex-wrap gap-4 text-sm font-medium">
        {navLink('/', 'Home')}
        {navLink('/active', 'Active Rounds')}
        {navLink('/vote', 'Community Vote')}
        {navLink('/myrounds', '🏆 My Rounds', 'font-semibold')}
        {navLink('/myo', '🎨 Make Your Own', 'font-semibold')}
        {navLink('/free', '🎁 Free Game', 'font-semibold')}
      </div>

      <main className="max-w-5xl mx-auto p-6 space-y-8">{children}</main>
    </div>
  )
}
