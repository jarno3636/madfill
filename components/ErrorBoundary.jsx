// components/ErrorBoundary.jsx
'use client'

import React, { Component } from 'react'
import { Button } from '@/components/ui/button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null, showDetails: false, resetKey: 0, copied: false }
    this.handleReset = this.handleReset.bind(this)
    this.copyDetails = this.copyDetails.bind(this)
    this.toggleDetails = this.toggleDetails.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log somewhere central if you want
    // e.g., Sentry.captureException(error, { extra: info })
    if (typeof this.props.onReport === 'function') {
      try { this.props.onReport(error, info) } catch {}
    }
    this.setState({ info })
    console.error('ErrorBoundary caught:', error, info)
  }

  handleReset() {
    this.setState({ hasError: false, error: null, info: null, showDetails: false, copied: false, resetKey: this.state.resetKey + 1 })
    if (typeof this.props.onReset === 'function') {
      try { this.props.onReset() } catch {}
    }
  }

  async copyDetails() {
    const text = this.buildDetailsText()
    try {
      await navigator.clipboard.writeText(text)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 1500)
    } catch {
      // fallback textarea copy
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 1500)
    }
  }

  toggleDetails() {
    this.setState(s => ({ showDetails: !s.showDetails }))
  }

  buildDetailsText() {
    const { error, info } = this.state
    const err = error?.toString?.() || String(error || 'Unknown error')
    const stack = (error?.stack || info?.componentStack || '').trim()
    const meta = typeof window !== 'undefined'
      ? `URL: ${window.location.href}\nUA: ${navigator.userAgent}\nTime: ${new Date().toISOString()}`
      : `Time: ${new Date().toISOString()}`
    return `MadFill Error\n\n${err}\n\n${stack}\n\n${meta}\n`
  }

  renderFallback() {
    const { error, info, showDetails, copied } = this.state
    const { title = 'Something went wrong.', subtitle = 'You can reload the page or try again.' } = this.props

    return (
      <div className="p-6 max-w-2xl mx-auto my-10 rounded-2xl bg-slate-900/80 text-white shadow-xl ring-1 ring-slate-700">
        <h2 className="text-2xl font-extrabold text-red-300">⚠️ {title}</h2>
        <p className="mt-2 text-sm text-slate-300">{subtitle}</p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button variant="secondary" onClick={this.handleReset} className="bg-emerald-600 hover:bg-emerald-500">
            Try again
          </Button>
          <Button variant="secondary" onClick={() => (window?.location?.reload?.())} className="bg-slate-700 hover:bg-slate-600">
            Reload page
          </Button>
          <Button variant="outline" onClick={this.toggleDetails} className="border-slate-500 text-slate-200">
            {showDetails ? 'Hide details' : 'Show details'}
          </Button>
        </div>

        {showDetails && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Error details</span>
              <Button variant="ghost" size="sm" onClick={this.copyDetails} className="text-indigo-300 hover:bg-indigo-500/10">
                {copied ? '✅ Copied' : '📋 Copy'}
              </Button>
            </div>
            <pre className="p-3 rounded-lg bg-slate-800 text-xs overflow-auto max-h-64 border border-slate-700">
{(error?.toString?.() || String(error || 'Unknown error'))}

{(error?.stack || info?.componentStack || '').trim()}
            </pre>
          </div>
        )}

        {typeof this.props.extra === 'function' ? (
          <div className="mt-4">{this.props.extra({ error, info, reset: this.handleReset })}</div>
        ) : this.props.extra ? (
          <div className="mt-4">{this.props.extra}</div>
        ) : null}
      </div>
    )
  }

  render() {
    if (this.state.hasError) {
      // Allow consumer to override fallback entirely
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, info: this.state.info, reset: this.handleReset })
          : this.props.fallback
      }
      return this.renderFallback()
    }

    // Key the child tree so "Try again" remounts it cleanly
    return <div key={this.state.resetKey}>{this.props.children}</div>
  }
}
