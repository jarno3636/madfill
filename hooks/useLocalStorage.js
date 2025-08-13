'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useLocalStorage(key, initialValue) {
  const isClient = typeof window !== 'undefined'
  const initial = useRef(initialValue)

  const [storedValue, setStoredValue] = useState(() => {
    if (!isClient) return initial.current
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initial.current
    } catch (e) {
      console.error(`Error reading localStorage key "${key}":`, e)
      return initial.current
    }
  })

  // write-through setter (supports functional updates)
  const setValue = useCallback((value) => {
    setStoredValue((prev) => {
      const valueToStore = value instanceof Function ? value(prev) : value
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (e) {
        console.error(`Error setting localStorage key "${key}":`, e)
      }
      return valueToStore
    })
  }, [key])

  // remove key
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initial.current)
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key)
      }
    } catch (e) {
      console.error(`Error removing localStorage key "${key}":`, e)
    }
  }, [key])

  // keep in sync across tabs
  useEffect(() => {
    if (!isClient) return
    const onStorage = (e) => {
      if (e.key !== key) return
      try {
        const next = e.newValue ? JSON.parse(e.newValue) : initial.current
        setStoredValue(next)
      } catch {
        setStoredValue(initial.current)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [isClient, key])

  return [storedValue, setValue, removeValue]
}

// ---- preferences
export function useUserPreferences() {
  const [preferences, setPreferences, removePreferences] = useLocalStorage('madfill_preferences', {
    theme: 'dark',
    defaultEntryFee: '0.01',
    notifications: true,
    autoConnect: false,
    preferredChainId: 8453,
  })

  const updatePreference = useCallback((k, v) => {
    setPreferences((prev) => ({ ...prev, [k]: v }))
  }, [setPreferences])

  return { preferences, updatePreference, resetPreferences: removePreferences }
}

// ---- drafts
export function useStoryDrafts() {
  const [drafts, setDrafts, clearAllDrafts] = useLocalStorage('madfill_story_drafts', [])

  const saveDraft = useCallback((draft) => {
    const now = new Date().toISOString()
    const newDraft = { id: Date.now().toString(), ...draft, createdAt: now, updatedAt: now }
    setDrafts((prev) => [newDraft, ...prev.slice(0, 9)])
    return newDraft.id
  }, [setDrafts])

  const updateDraft = useCallback((id, updates) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d))
    )
  }, [setDrafts])

  const deleteDraft = useCallback((id) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }, [setDrafts])

  const getDraft = useCallback((id) => drafts.find((d) => d.id === id), [drafts])

  return { drafts, saveDraft, updateDraft, deleteDraft, getDraft, clearAllDrafts }
}
