// components/ui/tooltip.jsx
'use client'

import { useEffect, useId, useRef, useState } from 'react'

export function Tooltip({
  children,
  text,
  placement = 'top', // 'top' | 'bottom' | 'left' | 'right'
  offset = 8,
  delay = 120, // ms before showing
  open, // controlled
  defaultOpen = false, // uncontrolled
  disabled = false,
  className = '',
  contentClassName = '',
}) {
  const [visibleUncontrolled, setVisibleUncontrolled] = useState(defaultOpen)
  const isControlled = typeof open === 'boolean'
  const visible = isControlled ? open : visibleUncontrolled

  const id = useId().replace(/:/g, '')
  const timerRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function show() {
    if (disabled) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (!isControlled) setVisibleUncontrolled(true)
    }, delay)
  }
  function hide() {
    clearTimeout(timerRef.current)
    if (!isControlled) setVisibleUncontrolled(false)
  }
  function toggle() {
    if (disabled) return
    if (isControlled) return
    setVisibleUncontrolled(v => !v)
  }

  // keyboard close (Esc)
  useEffect(() => {
    if (!visible) return
    const onKey = (e) => {
      if (e.key === 'Escape') hide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  const basePos =
    placement === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2'
      : placement === 'bottom'
      ? 'top-full left-1/2 -translate-x-1/2'
      : placement === 'left'
      ? 'right-full top-1/2 -translate-y-1/2'
      : 'left-full top-1/2 -translate-y-1/2' // right

  const offsetStyle =
    placement === 'top'
      ? { marginBottom: offset }
      : placement === 'bottom'
      ? { marginTop: offset }
      : placement === 'left'
      ? { marginRight: offset }
      : { marginLeft: offset }

  const arrowTransform =
    placement === 'top'
      ? 'translate(-50%, 100%) rotate(45deg)'
      : placement === 'bottom'
      ? 'translate(-50%, -100%) rotate(45deg)'
      : placement === 'left'
      ? 'translate(100%, -50%) rotate(45deg)'
      : 'translate(-100%, -50%) rotate(45deg)'

  const arrowPos =
    placement === 'top'
      ? 'top-full left-1/2'
      : placement === 'bottom'
      ? 'bottom-full left-1/2'
      : placement === 'left'
      ? 'left-full top-1/2'
      : 'right-full top-1/2'

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex items-center ${className}`}
      // mouse
      onMouseEnter={show}
      onMouseLeave={hide}
      // keyboard focus
      onFocus={show}
      onBlur={hide}
      // touch: tap to toggle
      onClick={toggle}
      tabIndex={0}
      aria-describedby={visible ? id : undefined}
    >
      {children}
      {visible && !disabled && (
        <div
          id={id}
          role="tooltip"
          aria-hidden={!visible}
          className={`absolute z-50 ${basePos} w-max max-w-xs px-3 py-2 rounded bg-slate-900 text-white text-xs shadow-xl whitespace-pre-wrap select-none
            opacity-0 translate-y-1 pointer-events-none
            data-[show=true]:opacity-100 data-[show=true]:translate-y-0
            transition-all duration-150 ${contentClassName}`}
          style={offsetStyle}
          data-show="true"
        >
          {text}
          {/* Arrow */}
          <span
            className={`absolute ${arrowPos} w-2 h-2 bg-slate-900 shadow-xl`}
            style={{ transform: arrowTransform }}
          />
        </div>
      )}
    </span>
  )
}
