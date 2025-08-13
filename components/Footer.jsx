// components/Footer.jsx

import Link from 'next/link'
import React from 'react'

export default function Footer({ className = '' }) {
  const year = new Date().getFullYear()

  const navGame = [
    { href: '/', label: 'Create Round' },
    { href: '/active', label: 'Active Rounds' },
    { href: '/vote', label: 'Community Vote' },
    { href: '/myo', label: 'Make Your Own' },
    { href: '/myrounds', label: 'My Rounds' },
    { href: '/free', label: 'Free Play' },
    { href: '/challenge', label: 'Challenge' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/profile', label: 'Profile' },
  ]

  const externalLinks = [
    { href: 'https://twitter.com/madfill', label: 'Twitter / X' },
    { href: 'https://warpcast.com/madfill', label: 'Farcaster' },
    { href: 'https://base.org', label: 'Base' },
  ]

  return (
    <footer
      className={`bg-slate-900/50 border-t border-purple-700 mt-auto ${className}`}
      aria-label="Site footer"
    >
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="col-span-2">
            <h3 className="mb-4 text-xl font-bold text-white">🧠 MadFill</h3>
            <p className="mb-4 text-sm text-purple-200">
              Fill the blank. Make it funny. Win the pot. A social word game on Base with real rewards.
            </p>
            <div className="flex gap-3">
              {externalLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 transition hover:text-white"
                  aria-label={l.label}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-semibold text-white">Game</h4>
            <ul className="space-y-2 text-sm">
              {navGame.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-purple-200 transition hover:text-white"
                    aria-label={item.label}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-semibold text-white">About</h4>
            <ul className="space-y-2 text-sm">
              {/* TODO: /terms and /privacy pages (add when available) */}
              <li className="text-purple-400/70">Terms (coming soon)</li>
              <li className="text-purple-400/70">Privacy (coming soon)</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-purple-700 pt-6 text-center">
          <p className="text-sm text-purple-300">
            © {year} MadFill. Built on Base. Powered by Farcaster.
          </p>
        </div>
      </div>
    </footer>
  )
}
