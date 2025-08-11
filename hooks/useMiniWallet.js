import { useState, useEffect, useCallback } from 'react';
import { miniApp } from '@farcaster/miniapp-sdk';

export function useMiniWallet() {
  const [address, setAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if wallet is already connected on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.parent !== window) {
        // We're in Farcaster environment
        const connected = await miniApp.wallet.isConnected();
        if (connected) {
          const walletAddress = await miniApp.wallet.getAddress();
          setAddress(walletAddress);
          setIsConnected(true);
        }
      } else {
        // Development mode - simulate wallet connection
        const mockAddress = localStorage.getItem('mock_wallet_address');
        if (mockAddress) {
          setAddress(mockAddress);
          setIsConnected(true);
        }
      }
    } catch (err) {
      console.error('Error checking wallet connection:', err);
      setError(err);
    }
  }, []);

  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (typeof window !== 'undefined' && window.parent !== window) {
        // We're in Farcaster environment
        const walletAddress = await miniApp.wallet.connect();
        setAddress(walletAddress);
        setIsConnected(true);
      } else {
        // Development mode - simulate wallet connection
        const mockAddress = '0x1234567890123456789012345678901234567890';
        localStorage.setItem('mock_wallet_address', mockAddress);
        setAddress(mockAddress);
        setIsConnected(true);
        console.log('Mock wallet connected:', mockAddress);
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.parent !== window) {
        // We're in Farcaster environment
        await miniApp.wallet.disconnect();
      } else {
        // Development mode
        localStorage.removeItem('mock_wallet_address');
        console.log('Mock wallet disconnected');
      }
      setAddress(null);
      setIsConnected(false);
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
      setError(err);
    }
  }, []);

  return {
    address,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    checkConnection
  };
}