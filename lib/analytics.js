// Ana// lib/analytics.js
// Analytics utilities for tracking user interactions and performance
// SSR-safe: no window access at module scope.

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID || ''

/** Internal: is GA usable right now? (client + gtag loaded + id present) */
function isAnalyticsReady() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function' && !!GA_TRACKING_ID
}

/** Low-level gtag wrapper (no-op if not ready) */
export function gtag(...args) {
  if (!isAnalyticsReady()) return
  // eslint-disable-next-line no-undef
  window.gtag(...args)
}

/** Track a page view */
export function pageview(url) {
  if (!isAnalyticsReady()) return
  gtag('config', GA_TRACKING_ID, { page_path: String(url || '/') })
}

/** Preferred event API */
export function trackEvent({ action, category, label, value }) {
  if (!isAnalyticsReady()) return
  const payload = {
    event_category: String(category || 'general'),
    ...(label != null ? { event_label: String(label) } : {}),
    ...(value != null ? { value: Number(value) } : {}),
  }
  gtag('event', String(action || 'unknown_action'), payload)
}

/** Back-compat alias for older callers */
export const event = trackEvent

// Custom event tracking for MadFill
export function trackGameEvent(action, details = {}) {
  trackEvent({
    action,
    category: 'Game',
    label: details.label || action,
    value: details.value ?? 1,
  })

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[analytics] Game Event:', action, details)
  }
}

export function trackWalletEvent(action, walletType = 'unknown') {
  trackEvent({
    action,
    category: 'Wallet',
    label: walletType,
    value: 1,
  })
}

export function trackContractEvent(action, contractName, details = {}) {
  trackEvent({
    action,
    category: 'Contract',
    label: `${contractName || 'unknown'}_${action || 'event'}`,
    value: details.value ?? 1,
  })
}

// Performance tracking (Web Vitals / custom timings)
export function trackPerformance(name, value) {
  if (!isAnalyticsReady()) return
  gtag('event', 'timing_complete', {
    name: String(name || 'metric'),
    value: Math.round(Number(value) || 0),
    event_category: 'Performance',
  })
}

// Error tracking
export function trackError(error, context = '') {
  if (isAnalyticsReady()) {
    const message = error?.message || String(error)
    gtag('event', 'exception', {
      description: `${context ? `${context}: ` : ''}${message}`,
      fatal: false,
    })
  }
  // Always log errors to console for observability
  // eslint-disable-next-line no-console
  console.error('[analytics] Tracked Error:', context, error)
}
