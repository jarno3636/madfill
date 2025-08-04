// components/ErrorBoundary.jsx
import React, { Component } from 'react'
import { Button } from '@/components/ui/button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-red-600">Something went wrong.</h2>
          <pre className="mt-4 p-4 bg-slate-100 text-sm text-red-800 rounded">
            {this.state.error?.toString()}
          </pre>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      )
    }
    return this.props.children
  }
}
