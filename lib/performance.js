// lib/performance.js

// Performance monitoring utilities

export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map()
    this.observers = new Map()

    if (typeof window !== 'undefined') {
      this.initializeObservers()
    }
  }

  initializeObservers() {
    // Web Vitals observer
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        if (!entries || entries.length === 0) return
        const lastEntry = entries[entries.length - 1]
        if (lastEntry && typeof lastEntry.startTime === 'number') {
          this.recordMetric('LCP', lastEntry.startTime)
        }
      })

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.set('LCP', lcpObserver)
      } catch {
        console.warn('LCP observer not supported')
      }

      // First Input Delay (FID). Note: superseded by INP, but kept for compatibility.
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        if (!entries || entries.length === 0) return
        entries.forEach((entry) => {
          const val = (entry?.processingStart ?? 0) - (entry?.startTime ?? 0)
          if (isFinite(val) && val >= 0) this.recordMetric('FID', val)
        })
      })

      try {
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.set('FID', fidObserver)
      } catch {
        console.warn('FID observer not supported')
      }

      // Cumulative Layout Shift
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        if (!entries || entries.length === 0) return
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            const v = Number(entry.value) || 0
            clsValue += v
            this.recordMetric('CLS', clsValue)
          }
        })
      })

      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.set('CLS', clsObserver)
      } catch {
        console.warn('CLS observer not supported')
      }
    }
  }

  recordMetric(name, value, tags = {}) {
    const timestamp = Date.now()

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    this.metrics.get(name).push({
      value,
      timestamp,
      tags,
    })

    // Send to analytics if available (no-op if GA not present)
    if (typeof window !== 'undefined' && window.gtag) {
      try {
        window.gtag('event', 'timing_complete', {
          name,
          value: Math.round(Number(value) || 0),
          event_category: 'Performance',
          // NOTE: GA4 custom dims need mapping; we retain tags for future wiring.
          // Avoid throwing if tags is large/unexpected.
          ...Object.fromEntries(Object.entries(tags || {})),
        })
      } catch {
        // swallow analytics errors
      }
    }
  }

  startTimer(name) {
    const now =
      (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? () => performance.now()
        : () => Date.now()

    const startTime = now()

    return {
      end: (tags = {}) => {
        const endTime = now()
        const duration = endTime - startTime
        this.recordMetric(name, duration, tags)
        return duration
      },
    }
  }

  async measureAsync(name, asyncFn, tags = {}) {
    const timer = this.startTimer(name)
    try {
      const result = await asyncFn()
      timer.end({ ...tags, status: 'success' })
      return result
    } catch (error) {
      timer.end({ ...tags, status: 'error', error: String(error?.message || error) })
      throw error
    }
  }

  getMetrics(name) {
    return this.metrics.get(name) || []
  }

  getAverageMetric(name) {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return 0
    const sum = metrics.reduce((acc, m) => acc + (Number(m.value) || 0), 0)
    return sum / metrics.length
  }

  getLatestMetric(name) {
    const metrics = this.getMetrics(name)
    return metrics.length ? metrics[metrics.length - 1] : null
  }

  exportMetrics() {
    const exported = {}

    for (const [name, metrics] of this.metrics.entries()) {
      exported[name] = {
        count: metrics.length,
        latest: this.getLatestMetric(name),
        average: this.getAverageMetric(name),
        all: metrics,
      }
    }

    return exported
  }

  cleanup() {
    // Disconnect all observers
    for (const observer of this.observers.values()) {
      try {
        observer.disconnect()
      } catch {
        // ignore
      }
    }
    this.observers.clear()
    this.metrics.clear()
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Convenience functions
export const recordMetric = (name, value, tags) => {
  performanceMonitor.recordMetric(name, value, tags)
}

export const startTimer = (name) => {
  return performanceMonitor.startTimer(name)
}

export const measureAsync = (name, asyncFn, tags) => {
  return performanceMonitor.measureAsync(name, asyncFn, tags)
}

// React-friendly accessor (not a stateful hook; name kept for DX)
export const usePerformanceMonitor = () => {
  return {
    recordMetric,
    startTimer,
    measureAsync,
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
    getAverageMetric: performanceMonitor.getAverageMetric.bind(performanceMonitor),
  }
}
