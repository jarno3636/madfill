import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useMiniWallet } from './useMiniWallet';

// Import your contract ABIs
const FILL_IN_STORY_ABI = [
  // Add your FillInStoryV3 ABI here
  "function createStoryPool(string memory theme, uint256 entryFee) external",
  "function joinStoryPool(uint256 poolId, string memory contribution) external payable",
  "function getActiveStoryPools() external view returns (tuple(uint256 id, string theme, uint256 entryFee, address creator, uint256 participantCount, bool isActive)[])",
  "function getUserStoryPools(address user) external view returns (uint256[])"
];

const MAD_FILL_NFT_ABI = [
  // Add your MadFillTemplateNFT ABI here
  "function mintStoryNFT(address to, string memory storyContent, string memory metadata) external",
  "function getUserNFTs(address user) external view returns (uint256[])",
  "function tokenURI(uint256 tokenId) external view returns (string)"
];

// Contract addresses - update these with your deployed contract addresses
const CONTRACT_ADDRESSES = {
  FILL_IN_STORY: "0x0000000000000000000000000000000000000000", // Replace with actual address
  MAD_FILL_NFT: "0x0000000000000000000000000000000000000000"   // Replace with actual address
};

export function useContracts() {
  const { address, isConnected } = useMiniWallet();
  const [contracts, setContracts] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize provider and contracts
  useEffect(() => {
    async function initializeContracts() {
      if (!isConnected || !address) {
        setContracts(null);
        setProvider(null);
        setSigner(null);
        return;
      }

      try {
        setIsLoading(true);
        
        // In a real app, you would get the provider from the Farcaster SDK
        // For development, we'll use a mock or fallback provider
        let ethProvider;
        let ethSigner;
        
        if (typeof window !== 'undefined' && window.ethereum) {
          // If MetaMask or similar is available
          ethProvider = new ethers.BrowserProvider(window.ethereum);
          ethSigner = await ethProvider.getSigner();
        } else {
          // Development mode - use read-only provider
          ethProvider = new ethers.JsonRpcProvider('https://rpc.ankr.com/eth'); // Mainnet RPC
          ethSigner = null; // Read-only mode
        }

        setProvider(ethProvider);
        setSigner(ethSigner);

        // Initialize contracts
        const fillInStoryContract = new ethers.Contract(
          CONTRACT_ADDRESSES.FILL_IN_STORY,
          FILL_IN_STORY_ABI,
          ethSigner || ethProvider
        );

        const madFillNFTContract = new ethers.Contract(
          CONTRACT_ADDRESSES.MAD_FILL_NFT,
          MAD_FILL_NFT_ABI,
          ethSigner || ethProvider
        );

        setContracts({
          fillInStory: fillInStoryContract,
          madFillNFT: madFillNFTContract
        });

      } catch (err) {
        console.error('Failed to initialize contracts:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    }

    initializeContracts();
  }, [isConnected, address]);

  // Contract interaction methods
  const createStoryPool = useCallback(async (theme, entryFee) => {
    if (!contracts?.fillInStory || !signer) {
      throw new Error('Contracts not initialized or no signer available');
    }

    try {
      const tx = await contracts.fillInStory.createStoryPool(theme, ethers.parseEther(entryFee.toString()));
      await tx.wait();
      return tx;
    } catch (err) {
      console.error('Failed to create story pool:', err);
      throw err;
    }
  }, [contracts, signer]);

  const joinStoryPool = useCallback(async (poolId, contribution, entryFee) => {
    if (!contracts?.fillInStory || !signer) {
      throw new Error('Contracts not initialized or no signer available');
    }

    try {
      const tx = await contracts.fillInStory.joinStoryPool(
        poolId, 
        contribution, 
        { value: ethers.parseEther(entryFee.toString()) }
      );
      await tx.wait();
      return tx;
    } catch (err) {
      console.error('Failed to join story pool:', err);
      throw err;
    }
  }, [contracts, signer]);

  const getActiveStoryPools = useCallback(async () => {
    if (!contracts?.fillInStory) {
      throw new Error('Contracts not initialized');
    }

    try {
      const pools = await contracts.fillInStory.getActiveStoryPools();
      return pools;
    } catch (err) {
      console.error('Failed to get active story pools:', err);
      throw err;
    }
  }, [contracts]);

  const getUserNFTs = useCallback(async (userAddress = address) => {
    if (!contracts?.madFillNFT || !userAddress) {
      throw new Error('Contracts not initialized or no user address');
    }

    try {
      const nftIds = await contracts.madFillNFT.getUserNFTs(userAddress);
      return nftIds;
    } catch (err) {
      console.error('Failed to get user NFTs:', err);
      throw err;
    }
  }, [contracts, address]);

  const mintStoryNFT = useCallback(async (storyContent, metadata) => {
    if (!contracts?.madFillNFT || !signer || !address) {
      throw new Error('Contracts not initialized, no signer, or no address available');
    }

    try {
      const tx = await contracts.madFillNFT.mintStoryNFT(address, storyContent, metadata);
      await tx.wait();
      return tx;
    } catch (err) {
      console.error('Failed to mint story NFT:', err);
      throw err;
    }
  }, [contracts, signer, address]);

  return {
    contracts,
    provider,
    signer,
    isLoading,
    error,
    // Contract methods
    createStoryPool,
    joinStoryPool,
    getActiveStoryPools,
    getUserNFTs,
    mintStoryNFT
  };
}