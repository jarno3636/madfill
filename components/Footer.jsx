// components/Footer.jsx
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="fixed bottom-0 inset-x-0 z-50 bg-gradient-to-br from-[#1a1a2e] to-[#2e003e] text-white text-sm py-3 shadow-inner">
      <div className="flex justify-center gap-6 items-center flex-wrap px-4">
        <Link
          href="https://x.com/MadFillBase"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-indigo-300 transition"
        >
          🐦 X: @MadFillBase
        </Link>
        <Link
          href="https://warpcast.com/madfill"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-indigo-300 transition"
        >
          🌐 Farcaster: @madfill
        </Link>
        <p className="text-xs text-slate-300 ml-4">Made with 🤪 on Base</p>
      </div>
    </footer>
  )
}
