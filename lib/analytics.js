// Analytics utilities for tracking user interactions and performance

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID

// Google Analytics
export const gtag = (...args) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args)
  }
}

export const pageview = (url) => {
  gtag('config', GA_TRACKING_ID, {
    page_path: url,
  })
}

export const event = ({ action, category, label, value }) => {
  gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  })
}

// Custom event tracking for MadFill
export const trackGameEvent = (action, details = {}) => {
  event({
    action,
    category: 'Game',
    label: details.label || action,
    value: details.value || 1
  })
  
  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Game Event:', action, details)
  }
}

export const trackWalletEvent = (action, walletType = 'unknown') => {
  event({
    action,
    category: 'Wallet',
    label: walletType,
    value: 1
  })
}

export const trackContractEvent = (action, contractName, details = {}) => {
  event({
    action,
    category: 'Contract',
    label: `${contractName}_${action}`,
    value: details.value || 1
  })
}

// Performance tracking
export const trackPerformance = (name, value) => {
  if (typeof window !== 'undefined' && window.gtag) {
    gtag('event', 'timing_complete', {
      name,
      value: Math.round(value),
      event_category: 'Performance'
    })
  }
}

// Error tracking
export const trackError = (error, context = '') => {
  if (typeof window !== 'undefined' && window.gtag) {
    gtag('event', 'exception', {
      description: `${context}: ${error.message || error}`,
      fatal: false,
    })
  }
  
  console.error('Tracked Error:', context, error)
}