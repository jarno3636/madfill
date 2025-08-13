// components/LoadingSpinner.jsx
import React from 'react'
import { cn } from '@/lib/utils'

/**
 * @typedef {'sm'|'md'|'lg'|'xl'} SpinnerSize
 */

/**
 * Loading spinner with accessible semantics.
 *
 * @param {Object} props
 * @param {SpinnerSize} [props.size='md'] - Visual size of the spinner.
 * @param {string|false} [props.text='Loading...'] - Optional text shown under the spinner. Pass falsy to hide.
 * @param {string} [props.className=''] - Extra class names for the container.
 */
export default function LoadingSpinner({ size = 'md', text = 'Loading...', className = '' }) {
  const sizeClassesMap = SIZE_CLASSES
  const textSizesMap = TEXT_SIZES

  const safeSize = Object.prototype.hasOwnProperty.call(sizeClassesMap, size) ? size : 'md'
  const spinnerClass = sizeClassesMap[safeSize]
  const textClass = textSizesMap[safeSize]

  return (
    <div
      className={cn('flex flex-col items-center justify-center space-y-3', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Visual spinner */}
      <div
        className={cn(
          'rounded-full animate-spin border-4 border-purple-200 border-t-purple-600',
          spinnerClass
        )}
        aria-hidden="true"
      />
      {/* Visible label (optional) */}
      {text ? (
        <p className={cn('text-white font-medium', textClass)}>{text}</p>
      ) : (
        // Screen reader-only fallback label when visible text is hidden
        <span className="sr-only">Loading…</span>
      )}
    </div>
  )
}

// Stable maps outside component to avoid re-allocation
const SIZE_CLASSES = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
}

const TEXT_SIZES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
}
