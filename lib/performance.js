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
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        this.recordMetric('LCP', lastEntry.startTime)
      })
      
      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.set('LCP', lcpObserver)
      } catch (e) {
        console.warn('LCP observer not supported')
      }

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          this.recordMetric('FID', entry.processingStart - entry.startTime)
        })
      })
      
      try {
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.set('FID', fidObserver)
      } catch (e) {
        console.warn('FID observer not supported')
      }

      // Cumulative Layout Shift
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
            this.recordMetric('CLS', clsValue)
          }
        })
      })
      
      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.set('CLS', clsObserver)
      } catch (e) {
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
      tags
    })

    // Send to analytics if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'timing_complete', {
        name,
        value: Math.round(value),
        event_category: 'Performance',
        custom_map: tags
      })
    }
  }

  startTimer(name) {
    const startTime = performance.now()
    
    return {
      end: (tags = {}) => {
        const endTime = performance.now()
        const duration = endTime - startTime
        this.recordMetric(name, duration, tags)
        return duration
      }
    }
  }

  async measureAsync(name, asyncFn, tags = {}) {
    const timer = this.startTimer(name)
    try {
      const result = await asyncFn()
      timer.end({ ...tags, status: 'success' })
      return result
    } catch (error) {
      timer.end({ ...tags, status: 'error', error: error.message })
      throw error
    }
  }

  getMetrics(name) {
    return this.metrics.get(name) || []
  }

  getAverageMetric(name) {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return 0
    
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0)
    return sum / metrics.length
  }

  getLatestMetric(name) {
    const metrics = this.getMetrics(name)
    return metrics[metrics.length - 1] || null
  }

  exportMetrics() {
    const exported = {}
    
    for (const [name, metrics] of this.metrics.entries()) {
      exported[name] = {
        count: metrics.length,
        latest: this.getLatestMetric(name),
        average: this.getAverageMetric(name),
        all: metrics
      }
    }
    
    return exported
  }

  cleanup() {
    // Disconnect all observers
    for (const observer of this.observers.values()) {
      observer.disconnect()
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

// React hook for component-level performance monitoring
export const usePerformanceMonitor = () => {
  return {
    recordMetric,
    startTimer,
    measureAsync,
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
    getAverageMetric: performanceMonitor.getAverageMetric.bind(performanceMonitor)
  }
}