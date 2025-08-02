import { shareFreeCast } from '../lib/shareFreeCast'

export default function ShareButton({ sentence, word }) {
  return (
    <button
      onClick={() => shareFreeCast({ sentence, word })}
      className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-full shadow-lg transition-all duration-200 hover:shadow-xl text-sm sm:text-base"
    >
      🎉 Share on Farcaster
    </button>
  )
}
