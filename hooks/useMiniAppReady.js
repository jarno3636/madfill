import { useState, useEffect } from 'react';
import { miniApp } from '@farcaster/miniapp-sdk';

export function useMiniAppReady() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function initializeMiniApp() {
      try {
        // Check if we're in Farcaster environment
        if (typeof window !== 'undefined' && window.parent !== window) {
          // We're in an iframe, likely in Farcaster
          await miniApp.ready();
          setIsReady(true);
        } else {
          // Development mode - simulate ready state
          console.log('Development mode: MiniApp SDK not available');
          setIsReady(true);
        }
      } catch (err) {
        console.error('Failed to initialize Mini App:', err);
        setError(err);
        // Still set ready to true for development
        setIsReady(true);
      }
    }

    initializeMiniApp();
  }, []);

  return { isReady, error };
}