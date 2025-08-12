// lib/farcasterConfig.js
export const FARCASTER_CONFIG = {
  defaultChainId: 8453, // Base
  supportedChains: [
    {
      key: 'base',
      id: 8453,
      hex: '0x2105',
      name: 'Base',
      rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org',
      blockExplorer: 'https://basescan.org',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    },
  ],
};

/** Accepts numeric id (e.g., 8453) or key (e.g., 'base') */
export function getChainInfo(idOrKey = FARCASTER_CONFIG.defaultChainId) {
  const chains = FARCASTER_CONFIG.supportedChains;
  if (typeof idOrKey === 'number') {
    return chains.find(c => c.id === idOrKey) || chains[0];
  }
  if (typeof idOrKey === 'string') {
    return chains.find(c => c.key === idOrKey) || chains[0];
  }
  return chains[0];
}
