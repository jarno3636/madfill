// components/StyledCard.jsx

export default function StyledCard({ parts, blanks, words }) {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-indigo-700 rounded-xl p-4 shadow-inner text-lg font-medium leading-relaxed space-x-1">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < blanks && (
            <span className="inline-block text-pink-400 font-bold mx-1">
              {words[i] || '____'}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}
