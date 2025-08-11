import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage(key, initialValue) {
  // Get value from localStorage or use initial value
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when value changes
  const setValue = useCallback((value) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Remove item from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

// Hook for managing user preferences
export function useUserPreferences() {
  const [preferences, setPreferences, removePreferences] = useLocalStorage('madfill_preferences', {
    theme: 'dark',
    defaultEntryFee: '0.01',
    notifications: true,
    autoConnect: false,
    preferredChainId: 8453 // Base
  });

  const updatePreference = useCallback((key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  }, [setPreferences]);

  return {
    preferences,
    updatePreference,
    resetPreferences: removePreferences
  };
}

// Hook for managing story drafts
export function useStoryDrafts() {
  const [drafts, setDrafts, removeDrafts] = useLocalStorage('madfill_story_drafts', []);

  const saveDraft = useCallback((draft) => {
    const newDraft = {
      id: Date.now().toString(),
      ...draft,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setDrafts(prev => [newDraft, ...prev.slice(0, 9)]); // Keep max 10 drafts
    return newDraft.id;
  }, [setDrafts]);

  const updateDraft = useCallback((id, updates) => {
    setDrafts(prev => prev.map(draft => 
      draft.id === id 
        ? { ...draft, ...updates, updatedAt: new Date().toISOString() }
        : draft
    ));
  }, [setDrafts]);

  const deleteDraft = useCallback((id) => {
    setDrafts(prev => prev.filter(draft => draft.id !== id));
  }, [setDrafts]);

  const getDraft = useCallback((id) => {
    return drafts.find(draft => draft.id === id);
  }, [drafts]);

  return {
    drafts,
    saveDraft,
    updateDraft,
    deleteDraft,
    getDraft,
    clearAllDrafts: removeDrafts
  };
}