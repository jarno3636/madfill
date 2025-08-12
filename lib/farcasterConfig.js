// lib/farcasterConfig.js
// Central configuration for Farcaster + Base integration

export const FARCASTER_CONFIG = {
  appName: 'MadFill',
  homeUrl: 'https://madfill.vercel.app',
  iconUrl: 'https://madfill.vercel.app/og/app-icon-1024.png',
  splashImageUrl: 'https://madfill.vercel.app/og/app-splash-200.png',
  splashBackgroundColor: '#1e1b4b',
  requiredChains: ['eip155:8453'], // Base mainnet
  requiredCapabilities: ['wallet.getEthereumProvider'],
  description:
    'Fill the blank. Win the pot. Create a round, enter with one word, vote Original vs Challenger on Base.',
};

// Useful for Frame and OG generation
export const CONTRACTS = {
  fillInStoryV3: '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b',
  madFillTemplateNFT: '0x0F22124A86F8893990fA4763393E46d97F4AF8E0c',
  chainId: 8453, // Base mainnet
  rpcUrl: 'https://mainnet.base.org',
};

export default FARCASTER_CONFIG;
