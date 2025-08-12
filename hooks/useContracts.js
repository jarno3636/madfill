import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useMiniWallet } from './useMiniWallet';

// Contract addresses from environment variables
const CONTRACT_ADDRESSES = {
  FILL_IN_STORY: process.env.NEXT_PUBLIC_FILLIN_ADDRESS || '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b',
  MAD_FILL_NFT: process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS || '0x0F22124A86F8893990fA4763393E46d97F4AF8E0c'
};

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453');

// Import ABIs
let FILL_IN_STORY_ABI, MAD_FILL_NFT_ABI;

// Dynamically import ABIs
async function loadABIs() {
  try {
    const [fillInStoryABI, madFillNFTABI] = await Promise.all([
      import('../abi/FillInStoryV3_ABI.json'),
      import('../abi/MadFillTemplateNFT_ABI.json')
    ]);
    
    FILL_IN_STORY_ABI = fillInStoryABI.default || fillInStoryABI;
    MAD_FILL_NFT_ABI = madFillNFTABI.default || madFillNFTABI;
  } catch (error) {
    console.error('Failed to load ABIs:', error);
    // Fallback minimal ABI
    FILL_IN_STORY_ABI = [
      "function createPool1(string memory name, string memory theme, string[] memory parts, string memory word, string memory username, uint256 entryFee, uint256 duration, uint256 blankIndex) external payable",
      "function joinPool1(uint256 poolId, string memory word, uint256 blankIndex) external payable",
      "function getPool1Info(uint256 poolId) external view returns (string, string, string[], uint256, uint256, address, address[], uint256, uint256, uint256)",
      "function pool1Count() external view returns (uint256)",
      "event Pool1Created(uint256 indexed id, address indexed creator, string name)"
    ];
    
    MAD_FILL_NFT_ABI = [
      "function mint(address to, string memory tokenURI) external",
      "function tokenURI(uint256 tokenId) external view returns (string)",
      "function balanceOf(address owner) external view returns (uint256)",
      "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)"
    ];
  }
}

export function useContracts() {
  const { address, isConnected } = useMiniWallet();
  const [contracts, setContracts] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [abiLoaded, setAbiLoaded] = useState(false);

  // Load ABIs on mount
  useEffect(() => {
    loadABIs().then(() => setAbiLoaded(true));
  }, []);

  // Initialize provider and contracts
  useEffect(() => {
    async function initializeContracts() {
      if (!abiLoaded) return;
      
      try {
        setIsLoading(true);
        setError(null);

        // Always initialize read-only provider
        const readProvider = new ethers.JsonRpcProvider(BASE_RPC);
        setProvider(readProvider);

        let ethSigner = null;

        // If connected, try to get signer
        if (isConnected && address) {
          try {
            if (typeof window !== 'undefined' && window.ethereum) {
              const browserProvider = new ethers.BrowserProvider(window.ethereum);
              
              // Check if we're on the correct network
              const network = await browserProvider.getNetwork();
              if (Number(network.chainId) !== CHAIN_ID) {
                try {
                  await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
                  });
                } catch (switchError) {
                  console.warn('Failed to switch network:', switchError);
                }
              }
              
              ethSigner = await browserProvider.getSigner();
              setSigner(ethSigner);
            }
          } catch (signerError) {
            console.warn('Failed to get signer:', signerError);
            // Continue with read-only mode
          }
        }

        // Initialize contracts
        const contractProvider = ethSigner || readProvider;
        
        const fillInStoryContract = new ethers.Contract(
          CONTRACT_ADDRESSES.FILL_IN_STORY,
          FILL_IN_STORY_ABI,
          contractProvider
        );

        const madFillNFTContract = new ethers.Contract(
          CONTRACT_ADDRESSES.MAD_FILL_NFT,
          MAD_FILL_NFT_ABI,
          contractProvider
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
  }, [isConnected, address, abiLoaded]);

  // Helper function for error handling
  const handleContractError = useCallback((error, operation) => {
    console.error(`${operation} failed:`, error);
    
    let message = 'Transaction failed';
    if (error.reason) {
      message = error.reason;
    } else if (error.message?.includes('user rejected')) {
      message = 'Transaction cancelled by user';
    } else if (error.message?.includes('insufficient funds')) {
      message = 'Insufficient funds for transaction';
    }
    
    throw new Error(message);
  }, []);

  // Contract interaction methods
  const createPool1 = useCallback(async (name, theme, parts, word, username, entryFee, duration, blankIndex) => {
    if (!contracts?.fillInStory || !signer) {
      throw new Error('Wallet not connected or contracts not initialized');
    }

    try {
      const feeWei = ethers.parseEther(entryFee.toString());
      const durationSeconds = BigInt(duration * 86400); // Convert days to seconds
      
      const tx = await contracts.fillInStory.createPool1(
        name,
        theme,
        parts,
        word,
        username,
        feeWei,
        durationSeconds,
        blankIndex,
        { value: feeWei }
      );
      
      const receipt = await tx.wait();
      return { tx, receipt };
    } catch (error) {
      handleContractError(error, 'Create Pool');
    }
  }, [contracts, signer, handleContractError]);

  const joinPool1 = useCallback(async (poolId, word, blankIndex, entryFee) => {
    if (!contracts?.fillInStory || !signer) {
      throw new Error('Wallet not connected or contracts not initialized');
    }

    try {
      const feeWei = ethers.parseEther(entryFee.toString());
      
      const tx = await contracts.fillInStory.joinPool1(
        poolId,
        word,
        blankIndex,
        { value: feeWei }
      );
      
      const receipt = await tx.wait();
      return { tx, receipt };
    } catch (error) {
      handleContractError(error, 'Join Pool');
    }
  }, [contracts, signer, handleContractError]);

  const getPool1Info = useCallback(async (poolId) => {
    if (!contracts?.fillInStory) {
      throw new Error('Contracts not initialized');
    }

    try {
      const info = await contracts.fillInStory.getPool1Info(poolId);
      return {
        name: info[0],
        theme: info[1],
        parts: info[2],
        entryFee: info[3],
        deadline: info[4],
        creator: info[5],
        participants: info[6],
        currentParticipants: info[7],
        maxParticipants: info[8],
        poolBalance: info[9]
      };
    } catch (error) {
      handleContractError(error, 'Get Pool Info');
    }
  }, [contracts, handleContractError]);

  const getPool1Count = useCallback(async () => {
    if (!contracts?.fillInStory) {
      throw new Error('Contracts not initialized');
    }

    try {
      const count = await contracts.fillInStory.pool1Count();
      return Number(count);
    } catch (error) {
      handleContractError(error, 'Get Pool Count');
    }
  }, [contracts, handleContractError]);

  return {
    contracts,
    provider,
    signer,
    isLoading,
    error,
    isReady: abiLoaded && contracts !== null,
    // Contract methods
    createPool1,
    joinPool1,
    getPool1Info,
    getPool1Count,
    // Contract addresses for reference
    addresses: CONTRACT_ADDRESSES
  };
}