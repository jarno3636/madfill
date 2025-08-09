// lib/chain.js
export const BASE_CHAIN_ID_DEC = 8453;
export const BASE_CHAIN_ID_HEX = '0x2105';

export const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org';

export const BASE_EXPLORER = 'https://basescan.org';

export const ADD_BASE_PARAMS = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base',
  rpcUrls: [BASE_RPC],
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: [BASE_EXPLORER],
};
