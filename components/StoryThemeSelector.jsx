// components/StoryThemeSelector.jsx
'use client'

import { useEffect, useMemo, useState } from 'react'

// Prefer repo source of themes; if not present, we'll fall back
// TODO: Ensure '@/data/templates' exports STORY_THEMES (string[])
let repoThemes
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@/data/templates')
  repoThemes = mod?.STORY_THEMES
} catch {
  repoThemes = undefined
}

// Safe defaults if repo export is missing
const DEFAULT_THEMES = [
  'Sci-Fi',
  'Fantasy',
  'Mystery',
  'Comedy',
  'Romance',
  'Cyberpunk',
  'Horror',
  'Adventure',
]

/**
 * Props:
 * - value: string (selected theme, 'custom' allowed)
 * - onChange: (newTheme: string) => void
 * - customValue: string (the custom theme text)
 * - onCustomChange: (text: string) => void
 * - themes?: string[] (optional override)
 */
export default function StoryThemeSelector({
  value,
  onChange,
  customValue,
  onCustomChange,
  themes,
}) {
  const themeList = useMemo(
    () => (Array.isArray(themes) && themes.length ? themes : (repoThemes || DEFAULT_THEMES)),
    [themes]
  )

  const [showCustom, setShowCustom] = useState(value === 'custom')

  // Keep local UI in sync if parent flips value
  useEffect(() => {
    setShowCustom(value === 'custom')
  }, [value])

  const handleThemeSelect = (theme) => {
    if (theme === 'custom') {
      setShowCustom(true)
      onChange?.('custom')
    } else {
      setShowCustom(false)
      onChange?.(theme)
      onCustomChange?.('') // clear previous custom text
    }
  }

  return (
    <div className="space-y-4">
      <label className="block text-white text-sm font-medium mb-2">
        Story Theme
      </label>

      {/* Predefined themes grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {themeList.map((theme) => {
          const selected = value === theme
          return (
            <button
              key={theme}
              type="button"
              onClick={() => handleThemeSelect(theme)}
              aria-pressed={selected}
              className={[
                'p-3 rounded-lg text-sm font-medium transition-all duration-200 outline-none',
                'focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-0',
                selected
                  ? 'bg-yellow-500 text-black shadow-lg scale-[1.02]'
                  : 'bg-white/20 text-white hover:bg-white/30 hover:scale-[1.02]',
              ].join(' ')}
              title={selected ? `${theme} (selected)` : theme}
            >
              {theme}
            </button>
          )
        })}

        {/* Custom theme option */}
        <button
          type="button"
          onClick={() => handleThemeSelect('custom')}
          aria-pressed={value === 'custom'}
          className={[
            'p-3 rounded-lg text-sm font-medium transition-all duration-200 border-2 border-dashed outline-none',
            'focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-0',
            value === 'custom'
              ? 'bg-yellow-500 text-black border-yellow-600 shadow-lg scale-[1.02]'
              : 'border-purple-400 text-purple-300 hover:border-yellow-500 hover:bg-white/10',
          ].join(' ')}
          title={value === 'custom' ? 'Custom (selected)' : 'Custom'}
        >
          ✏️ Custom Theme
        </button>
      </div>

      {/* Custom theme input */}
      {showCustom && (
        <div className="transition-opacity duration-200 opacity-100">
          <input
            type="text"
            value={customValue}
            onChange={(e) => onCustomChange?.(e.target.value)}
            placeholder="Enter your custom theme..."
            className={[
              'mt-2 w-full rounded-lg',
              'bg-white/10 text-white placeholder-purple-200/70',
              'border border-purple-400 focus:border-yellow-500',
              'focus:outline-none focus:ring-2 focus:ring-yellow-500/60',
              'px-3 py-2 text-sm',
            ].join(' ')}
            maxLength={100}
            required={value === 'custom'}
            aria-label="Custom story theme"
          />
          <p className="text-purple-200 text-xs mt-1">
            Create your own unique story theme (3–100 characters).
          </p>
        </div>
      )}
    </div>
  )
}
