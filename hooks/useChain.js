import { useState, useEffect, useCallback } from 'react';
import { FARCASTER_CONFIG, getChainInfo } from '../lib/farcasterConfig';
import { useMiniWallet } from './useMiniWallet';

export function useChain() {
  const { isConnected } = useMiniWallet();
  const [currentChainId, setCurrentChainId] = useState(FARCASTER_CONFIG.defaultChainId);
  const [isCorrectChain, setIsCorrectChain] = useState(true);
  const [switching, setSwitching] = useState(false);

  // Check current chain when wallet connects
  useEffect(() => {
    if (isConnected) {
      checkCurrentChain();
    }
  }, [isConnected]);

  const checkCurrentChain = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const numericChainId = parseInt(chainId, 16);
        setCurrentChainId(numericChainId);
        
        // Check if current chain is supported
        const supportedChainIds = FARCASTER_CONFIG.supportedChains.map(chain => chain.id);
        setIsCorrectChain(supportedChainIds.includes(numericChainId));
      }
    } catch (error) {
      console.error('Error checking current chain:', error);
    }
  }, []);

  const switchToChain = useCallback(async (targetChainId) => {
    if (!window.ethereum) {
      throw new Error('No wallet provider found');
    }

    setSwitching(true);
    try {
      const chainInfo = getChainInfo(targetChainId);
      if (!chainInfo) {
        throw new Error(`Unsupported chain ID: ${targetChainId}`);
      }

      // Convert chain ID to hex
      const hexChainId = `0x${targetChainId.toString(16)}`;

      try {
        // Try to switch to the chain
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        });
      } catch (switchError) {
        // If chain doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: hexChainId,
              chainName: chainInfo.name,
              rpcUrls: [chainInfo.rpcUrl],
              blockExplorerUrls: [chainInfo.blockExplorer],
              nativeCurrency: {
                name: "ETH",
                symbol: "ETH",
                decimals: 18
              }
            }],
          });
        } else {
          throw switchError;
        }
      }

      setCurrentChainId(targetChainId);
      setIsCorrectChain(true);
    } catch (error) {
      console.error('Error switching chain:', error);
      throw error;
    } finally {
      setSwitching(false);
    }
  }, []);

  const switchToDefaultChain = useCallback(() => {
    return switchToChain(FARCASTER_CONFIG.defaultChainId);
  }, [switchToChain]);

  return {
    currentChainId,
    currentChain: getChainInfo(currentChainId),
    isCorrectChain,
    switching,
    supportedChains: FARCASTER_CONFIG.supportedChains,
    switchToChain,
    switchToDefaultChain,
    checkCurrentChain
  };
}