// lib/farcasterConfig.js
export const CHAINS = {
  base: {
    id: 8453,
    hex: '0x2105',
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org',
    name: 'Base',
    explorer: 'https://basescan.org',
  },
};

export function getChainInfo(key = 'base') {
  return CHAINS[key] || CHAINS.base;
}
