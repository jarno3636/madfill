import { useState } from 'react';
import { STORY_THEMES } from '../utils/constants';

export default function StoryThemeSelector({ value, onChange, customValue, onCustomChange }) {
  const [showCustom, setShowCustom] = useState(value === 'custom');

  const handleThemeSelect = (theme) => {
    if (theme === 'custom') {
      setShowCustom(true);
      onChange('custom');
    } else {
      setShowCustom(false);
      onChange(theme);
      onCustomChange('');
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-white text-sm font-medium mb-2">
        Story Theme
      </label>
      
      {/* Predefined themes grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {STORY_THEMES.map((theme) => (
          <button
            key={theme}
            type="button"
            onClick={() => handleThemeSelect(theme)}
            className={`
              p-3 rounded-lg text-sm font-medium transition-all duration-200
              ${value === theme
                ? 'bg-yellow-500 text-black shadow-lg transform scale-105'
                : 'bg-white/20 text-white hover:bg-white/30 hover:scale-105'
              }
            `}
          >
            {theme}
          </button>
        ))}
        
        {/* Custom theme option */}
        <button
          type="button"
          onClick={() => handleThemeSelect('custom')}
          className={`
            p-3 rounded-lg text-sm font-medium transition-all duration-200 border-2 border-dashed
            ${value === 'custom'
              ? 'bg-yellow-500 text-black border-yellow-600 shadow-lg transform scale-105'
              : 'border-purple-400 text-purple-300 hover:border-yellow-500 hover:bg-white/10'
            }
          `}
        >
          ✏️ Custom Theme
        </button>
      </div>

      {/* Custom theme input */}
      {showCustom && (
        <div className="fade-in">
          <input
            type="text"
            value={customValue}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="Enter your custom theme..."
            className="input-primary"
            maxLength={100}
            required={value === 'custom'}
          />
          <p className="text-purple-200 text-xs mt-1">
            Create your own unique story theme (3-100 characters)
          </p>
        </div>
      )}
    </div>
  );
}