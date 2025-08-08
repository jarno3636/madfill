import React from 'react'
import clsx from 'clsx'

export function Card({
  children,
  className = '',
  variant = 'gradient', // gradient, glass, outline, solid
  hoverEffect = 'lift', // none, lift, glow, scale
}) {
  const variantStyles = {
    gradient: 'bg-gradient-to-br from-indigo-900 to-purple-900 text-white shadow-lg',
    glass: 'bg-white/10 backdrop-blur-md border border-white/20 text-white',
    outline: 'border border-pink-400 text-white bg-transparent',
    solid: 'bg-slate-900 text-white shadow-lg'
  }

  const hoverStyles = {
    none: '',
    lift: 'transition-transform transform hover:-translate-y-1',
    glow: 'transition-shadow hover:shadow-xl hover:shadow-pink-500/30',
    scale: 'transition-transform transform hover:scale-105'
  }

  return (
    <div
      className={clsx(
        'rounded-2xl overflow-hidden transition-all',
        variantStyles[variant],
        hoverStyles[hoverEffect],
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={clsx('px-4 py-3 text-lg font-bold border-b border-white/20', className)}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={clsx('p-4', className)}>
      {children}
    </div>
  )
}
