// components/Footer.jsx
'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

const BASE_EXPLORER = 'https://basescan.org'

export default function Footer() {
  const [copied, setCopied] = useState(false)
  const year = new Date().getFullYear()
  const contract = process.env.NEXT_PUBLIC_FILLIN_ADDRESS

  const contractUrl = useMemo(() => {
    if (!contract) return null
    return `${BASE_EXPLORER}/address/${contract}`
  }, [contract])

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://madfill.vercel.app'

  async function copySiteLink() {
    try {
      await navigator.clipboard.writeText(siteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = siteUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <footer className="mt-12">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
      <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: brand / blurb */}
            <div className="space-y-1">
              <div className="text-lg font-extrabold tracking-tight">🧠 MadFill</div>
              <p className="text-xs text-slate-300">
                Made with 🤪 on Base. Fill the blank, win the bag.
              </p>
            </div>

            {/* Middle: socials */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="https://x.com/MadFillBase"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MadFill on X"
                className="px-3 py-1.5 rounded-full bg-slate-900/70 border border-slate-700 hover:border-indigo-400 hover:bg-slate-900 transition text-sm"
              >
                🐦 X: @MadFillBase
              </Link>
              <Link
                href="https://warpcast.com/madfill"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MadFill on Farcaster"
                className="px-3 py-1.5 rounded-full bg-slate-900/70 border border-slate-700 hover:border-indigo-400 hover:bg-slate-900 transition text-sm"
              >
                🌀 Farcaster: @madfill
              </Link>
              {contractUrl && (
                <Link
                  href={contractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View contract on Basescan"
                  className="px-3 py-1.5 rounded-full bg-slate-900/70 border border-slate-700 hover:border-indigo-400 hover:bg-slate-900 transition text-sm"
                >
                  🔗 Contract
                </Link>
              )}
              <button
                onClick={copySiteLink}
                className="px-3 py-1.5 rounded-full bg-slate-900/70 border border-slate-700 hover:border-indigo-400 hover:bg-slate-900 transition text-sm"
                title="Copy site link"
              >
                {copied ? '✅ Copied' : '📋 Share link'}
              </button>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              © {year} MadFill — All fun, no refunds 😉
            </div>
            <div className="flex items-center gap-4 text-xs">
              <Link href="/active" className="text-slate-300 hover:text-indigo-300">Active</Link>
              <Link href="/vote" className="text-slate-300 hover:text-indigo-300">Vote</Link>
              <Link href="/myrounds" className="text-slate-300 hover:text-indigo-300">My Rounds</Link>
              <a
                href="mailto:hello@madfill.app"
                className="text-slate-300 hover:text-indigo-300"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
