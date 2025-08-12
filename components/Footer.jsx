export default function Footer() {
  return (
    <footer className="bg-slate-900/50 border-t border-purple-700 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="col-span-2">
            <h3 className="text-xl font-bold text-white mb-4">🧠 MadFill</h3>
            <p className="text-purple-200 text-sm mb-4">
              Fill the blank. Make it funny. Win the pot. A social word game on Base with real rewards.
            </p>
            <div className="flex gap-3">
              <a href="https://twitter.com/madfill" className="text-purple-300 hover:text-white transition">
                Twitter
              </a>
              <a href="https://farcaster.xyz/madfill" className="text-purple-300 hover:text-white transition">
                Farcaster
              </a>
              <a href="https://base.org" className="text-purple-300 hover:text-white transition">
                Base
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-3">Game</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/" className="text-purple-200 hover:text-white transition">Create Round</a></li>
              <li><a href="/active" className="text-purple-200 hover:text-white transition">Active Rounds</a></li>
              <li><a href="/vote" className="text-purple-200 hover:text-white transition">Community Vote</a></li>
              <li><a href="/myo" className="text-purple-200 hover:text-white transition">Make Your Own</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-3">About</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/how-to-play" className="text-purple-200 hover:text-white transition">How to Play</a></li>
              <li><a href="/faq" className="text-purple-200 hover:text-white transition">FAQ</a></li>
              <li><a href="/terms" className="text-purple-200 hover:text-white transition">Terms</a></li>
              <li><a href="/privacy" className="text-purple-200 hover:text-white transition">Privacy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-purple-700 mt-8 pt-6 text-center">
          <p className="text-purple-300 text-sm">
            © 2024 MadFill. Built on Base. Powered by Farcaster.
          </p>
        </div>
      </div>
    </footer>
  )
}