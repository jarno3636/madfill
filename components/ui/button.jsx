import { forwardRef } from 'react'
import { clsx } from 'clsx'

const Button = forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default', 
  children, 
  disabled,
  ...props 
}, ref) => {
  const baseClasses = `
    inline-flex items-center justify-center 
    rounded-md font-medium transition-colors
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:pointer-events-none disabled:opacity-50
  `
  
  const variants = {
    default: 'bg-purple-600 text-white hover:bg-purple-700',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-purple-300 text-purple-300 hover:bg-purple-600 hover:text-white',
    secondary: 'bg-yellow-500 text-black hover:bg-yellow-600',
    ghost: 'hover:bg-purple-600 hover:text-white',
    link: 'text-purple-400 underline-offset-4 hover:underline'
  }
  
  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10'
  }
  
  return (
    <button
      className={clsx(
        baseClasses,
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
})

Button.displayName = 'Button'

export { Button }