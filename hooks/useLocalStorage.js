// hooks/useLocalStorage.js
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Detects whether localStorage is usable (guards Safari private mode, etc.). */
function storageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const k = '__mf_probe__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

/** Safe JSON.parse with fallback. */
function safeParse(json, fallback) {
  try {
    return json == null ? fallback : JSON.parse(json)
  } catch {
    return fallback
  }
}

/** Safe JSON.stringify that tolerates BigInt by stringifying it. */
function safeStringify(value) {
  try {
    return JSON.stringify(
      value,
      (_, v) => (typeof v === 'bigint' ? v.toString() : v) // defensive for mixed objects
    )
  } catch (e) {
    // Last resort: stringify a shallow copy to avoid cycles
    try {
      const shallow =
        value && typeof value === 'object' ? { ...value } : String(value)
      return JSON.stringify(shallow)
    } catch {
      return JSON.stringify(null)
    }
  }
}

/**
 * useLocalStorage
 * API-compatible: returns [storedValue, setValue, removeValue]
 */
export function useLocalStorage(key, initialValue) {
  const isClient = typeof window !== 'undefined'
  const canUseStorage = useRef(storageAvailable())
  const initial = useRef(initialValue)

  const read = useCallback(() => {
    if (!isClient || !canUseStorage.current) return initial.current
    try {
      const item = window.localStorage.getItem(key)
      return safeParse(item, initial.current)
    } catch (e) {
      console.error(`madfill: read localStorage "${key}" failed:`, e)
      return initial.current
    }
  }, [isClient, key])

  const [storedValue, setStoredValue] = useState(read)

  // Reload when the key changes
  useEffect(() => {
    setStoredValue(read())
  }, [key, read])

  // write-through setter (supports functional updates)
  const setValue = useCallback(
    (value) => {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value
        try {
          if (typeof window !== 'undefined' && canUseStorage.current) {
            window.localStorage.setItem(key, safeStringify(valueToStore))
          }
        } catch (e) {
          console.error(`madfill: set localStorage "${key}" failed:`, e)
        }
        return valueToStore
      })
    },
    [key]
  )

  // remove key
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initial.current)
      if (typeof window !== 'undefined' && canUseStorage.current) {
        window.localStorage.removeItem(key)
      }
    } catch (e) {
      console.error(`madfill: remove localStorage "${key}" failed:`, e)
    }
  }, [key])

  // keep in sync across tabs
  useEffect(() => {
    if (!isClient || !canUseStorage.current) return
    const onStorage = (e) => {
      if (e.key !== key) return
      setStoredValue(safeParse(e.newValue, initial.current))
    }
    window.addEventListener('storage', onStorage)

    // Refresh when returning to the tab (in case storage changed)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setStoredValue(read())
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isClient, key, read])

  return [storedValue, setValue, removeValue]
}

// ---- preferences (kept API/states the same)
export function useUserPreferences() {
  const [preferences, setPreferences, removePreferences] = useLocalStorage(
    'madfill_preferences',
    {
      theme: 'dark',
      defaultEntryFee: '0.01',
      notifications: true,
      autoConnect: false,
      preferredChainId: 8453,
    }
  )

  const updatePreference = useCallback(
    (k, v) => {
      setPreferences((prev) => ({ ...prev, [k]: v }))
    },
    [setPreferences]
  )

  return { preferences, updatePreference, resetPreferences: removePreferences }
}

// ---- drafts (kept API/states the same)
export function useStoryDrafts() {
  const [drafts, setDrafts, clearAllDrafts] = useLocalStorage(
    'madfill_story_drafts',
    []
  )

  const saveDraft = useCallback(
    (draft) => {
      const now = new Date().toISOString()
      const newDraft = {
        id: Date.now().toString(),
        ...draft,
        createdAt: now,
        updatedAt: now,
      }
      setDrafts((prev) => [newDraft, ...prev.slice(0, 9)])
      return newDraft.id
    },
    [setDrafts]
  )

  const updateDraft = useCallback(
    (id, updates) => {
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
        )
      )
    },
    [setDrafts]
  )

  const deleteDraft = useCallback(
    (id) => {
      setDrafts((prev) => prev.filter((d) => d.id !== id))
    },
    [setDrafts]
  )

  const getDraft = useCallback((id) => drafts.find((d) => d.id === id), [drafts])

  return {
    drafts,
    saveDraft,
    updateDraft,
    deleteDraft,
    getDraft,
    clearAllDrafts,
  }
}
