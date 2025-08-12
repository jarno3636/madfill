// hooks/useChain.js
import { useState, useEffect, useCallback } from 'react';
import { FARCASTER_CONFIG, getChainInfo } from '../lib/farcasterConfig';
import { useMiniWallet } from './useMiniWallet';

export function useChain() {
  const { isConnected } = useMiniWallet();
  const [currentChainId, setCurrentChainId] = useState(FARCASTER_CONFIG.defaultChainId);
  const [isCorrectChain, setIsCorrectChain] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (isConnected) checkCurrentChain();
  }, [isConnected]);

  const checkCurrentChain = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum?.request) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        const numeric = parseInt(chainIdHex, 16);
        setCurrentChainId(numeric);
        const ids = FARCASTER_CONFIG.supportedChains.map(c => c.id);
        setIsCorrectChain(ids.includes(numeric));
      }
    } catch (e) {
      console.error('Error checking current chain:', e);
    }
  }, []);

  const switchToChain = useCallback(async (targetChainId) => {
    if (!window?.ethereum?.request) throw new Error('No wallet provider found');
    setSwitching(true);
    try {
      const info = getChainInfo(targetChainId);
      if (!info) throw new Error(`Unsupported chain ID: ${targetChainId}`);
      const hexChainId = `0x${targetChainId.toString(16)}`;

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        });
      } catch (err) {
        if (err?.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: hexChainId,
              chainName: info.name,
              rpcUrls: [info.rpcUrl],
              blockExplorerUrls: [info.blockExplorer],
              nativeCurrency: info.nativeCurrency,
            }],
          });
        } else {
          throw err;
        }
      }

      setCurrentChainId(targetChainId);
      setIsCorrectChain(true);
    } catch (e) {
      console.error('Error switching chain:', e);
      throw e;
    } finally {
      setSwitching(false);
    }
  }, []);

  const switchToDefaultChain = useCallback(() => switchToChain(FARCASTER_CONFIG.defaultChainId), [switchToChain]);

  return {
    currentChainId,
    currentChain: getChainInfo(currentChainId),
    isCorrectChain,
    switching,
    supportedChains: FARCASTER_CONFIG.supportedChains,
    switchToChain,
    switchToDefaultChain,
    checkCurrentChain,
  };
}
