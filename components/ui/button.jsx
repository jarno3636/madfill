import React from 'react'
import clsx from 'clsx'

export function Button({
  children,
  className = '',
  variant = 'primary', // primary, secondary, outline, glass
  size = 'md', // sm, md, lg
  ...props
}) {
  const variantStyles = {
    primary: 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow hover:from-pink-400 hover:to-purple-400',
    secondary: 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow hover:from-indigo-400 hover:to-blue-400',
    outline: 'border border-pink-400 text-pink-400 hover:bg-pink-500/10',
    glass: 'bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20'
  }

  const sizeStyles = {
    sm: 'px-3 py-1 text-sm rounded-lg',
    md: 'px-4 py-2 text-base rounded-xl',
    lg: 'px-6 py-3 text-lg rounded-2xl'
  }

  return (
    <button
      className={clsx(
        'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
