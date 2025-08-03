// components/CompareCards.jsx
import React from 'react'

export default function CompareCards({ original, challenger, tpl }) {
  const renderCard = (word, label, color) => {
    const parts = tpl.parts.map((part, i) => (
      <span key={i}>
        {part}
        {i < tpl.blanks && (
          <span className="font-bold underline text-yellow-300">{i === 0 ? word : '____'}</span>
        )}
      </span>
    ))

    return (
      <div className={`border p-4 rounded bg-slate-800 text-white shadow-md ${color}`}>
        <p className="text-sm mb-2 font-semibold">{label}</p>
        <div className="font-mono text-sm leading-relaxed">{parts}</div>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {renderCard(original, 'Original Card', 'border-green-600')}
      {renderCard(challenger, 'Challenger Card', 'border-blue-600')}
    </div>
  )
}
