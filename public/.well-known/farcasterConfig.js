// Farcaster Mini App Configuration
export const FARCASTER_CONFIG = {
  // App metadata
  name: "MadFill",
  description: "Create collaborative Mad Libs stories and mint them as NFTs",
  icon: "🎭",
  
  // Supported chains
  supportedChains: [
    {
      id: 1,
      name: "Ethereum Mainnet",
      rpcUrl: "https://rpc.ankr.com/eth",
      blockExplorer: "https://etherscan.io"
    },
    {
      id: 137,
      name: "Polygon",
      rpcUrl: "https://rpc.ankr.com/polygon",
      blockExplorer: "https://polygonscan.com"
    },
    {
      id: 8453,
      name: "Base",
      rpcUrl: "https://mainnet.base.org",
      blockExplorer: "https://basescan.org"
    }
  ],
  
  // Default chain (Base is popular for Farcaster apps)
  defaultChainId: 8453,
  
  // Contract addresses per chain
  contracts: {
    1: { // Ethereum
      fillInStory: "0x0000000000000000000000000000000000000000",
      madFillNFT: "0x0000000000000000000000000000000000000000"
    },
    137: { // Polygon
      fillInStory: "0x0000000000000000000000000000000000000000", 
      madFillNFT: "0x0000000000000000000000000000000000000000"
    },
    8453: { // Base
      fillInStory: "0x0000000000000000000000000000000000000000",
      madFillNFT: "0x0000000000000000000000000000000000000000"
    }
  },
  
  // App URLs
  urls: {
    website: "https://farcaster-mini.vercel.app",
    docs: "https://github.com/jarno3636/madfill",
    support: "https://warpcast.com/jarno3636"
  },
  
  // Feature flags
  features: {
    enableNFTMinting: true,
    enableStoryVoting: true,
    enableRewards: true,
    maxStoryLength: 1000,
    minEntryFee: "0.001", // ETH
    maxEntryFee: "1.0"    // ETH
  }
};

// Helper function to get contract address for current chain
export function getContractAddress(contractName, chainId = FARCASTER_CONFIG.defaultChainId) {
  const contracts = FARCASTER_CONFIG.contracts[chainId];
  if (!contracts) {
    throw new Error(`No contracts configured for chain ID ${chainId}`);
  }
  
  const address = contracts[contractName];
  if (!address || address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Contract ${contractName} not deployed on chain ${chainId}`);
  }
  
  return address;
}

// Helper function to get chain info
export function getChainInfo(chainId) {
  return FARCASTER_CONFIG.supportedChains.find(chain => chain.id === chainId);
}