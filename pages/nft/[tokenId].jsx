import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useMiniWallet } from '../../hooks/useMiniWallet';
import { useContracts } from '../../hooks/useContracts';
import { useToast } from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatAddress } from '../../utils/validation';

export default function NFTDetails() {
  const router = useRouter();
  const { tokenId } = router.query;
  const { address, isConnected } = useMiniWallet();
  const { contracts } = useContracts();
  const { addToast } = useToast();

  const [nft, setNft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (tokenId && contracts) {
      loadNFTDetails();
    }
  }, [tokenId, contracts]);

  const loadNFTDetails = async () => {
    try {
      setLoading(true);
      
      // In a real app, you'd fetch NFT metadata from your contract
      // For now, we'll create mock NFT data
      const mockNFT = {
        tokenId: tokenId,
        name: `MadFill Story #${tokenId}`,
        description: 'A collaborative story created through MadFill',
        theme: 'Space Adventure',
        storyContent: 'Captain Sarah discovered a mysterious crystal on planet Zephyr. The alien creature was glowing and spoke in musical tones. Our spaceship needed three power cores to reach the distant galaxy...',
        image: `/api/nft-image/${tokenId}`, // You'd generate this
        attributes: [
          { trait_type: 'Theme', value: 'Space Adventure' },
          { trait_type: 'Contributors', value: 5 },
          { trait_type: 'Word Count', value: 247 },
          { trait_type: 'Created Date', value: new Date().toLocaleDateString() },
          { trait_type: 'Rarity', value: 'Rare' }
        ],
        owner: address || '0x1234567890123456789012345678901234567890',
        creators: [
          '0x1234567890123456789012345678901234567890',
          '0x2345678901234567890123456789012345678901',
          '0x3456789012345678901234567890123456789012'
        ]
      };
      
      setNft(mockNFT);
    } catch (error) {
      console.error('Error loading NFT details:', error);
      addToast('Failed to load NFT details', 'error');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: nft.name,
          text: `Check out this collaborative story NFT: "${nft.theme}"`,
          url: window.location.href
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        addToast('Link copied to clipboard!', 'success');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      addToast('Failed to share NFT', 'error');
    } finally {
      setSharing(false);
    }
  };

  const handleOpenOnOpenSea = () => {
    // Replace with your actual contract address and network
    const openSeaUrl = `https://opensea.io/assets/ethereum/YOUR_CONTRACT_ADDRESS/${tokenId}`;
    window.open(openSeaUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <LoadingSpinner size="xl" text="Loading NFT..." />
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">NFT Not Found</h2>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-purple-200 hover:text-white transition-colors"
          >
            ← Back to Collection
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="btn-outline"
            >
              {sharing ? 'Sharing...' : '📤 Share'}
            </button>
            
            <button
              onClick={handleOpenOnOpenSea}
              className="btn-primary"
            >
              View on OpenSea
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* NFT Image */}
          <div className="card">
            <div className="aspect-square bg-gradient-to-br from-purple-400 via-pink-400 to-yellow-400 rounded-lg flex items-center justify-center mb-4">
              <div className="text-center text-white">
                <div className="text-6xl mb-4">🎭</div>
                <h3 className="text-2xl font-bold">{nft.name}</h3>
                <p className="text-lg">{nft.theme}</p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <div className="text-yellow-400 font-bold text-lg">
                  {nft.attributes.find(a => a.trait_type === 'Contributors')?.value || 0}
                </div>
                <div className="text-purple-200 text-sm">Contributors</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <div className="text-yellow-400 font-bold text-lg">
                  {nft.attributes.find(a => a.trait_type === 'Word Count')?.value || 0}
                </div>
                <div className="text-purple-200 text-sm">Words</div>
              </div>
            </div>
          </div>

          {/* NFT Details */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="card">
              <h1 className="text-3xl font-bold text-white mb-2">{nft.name}</h1>
              <p className="text-purple-200 mb-4">{nft.description}</p>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-purple-200">Owner:</span>
                <span className="text-yellow-400 font-medium">
                  {formatAddress(nft.owner)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-purple-200">Token ID:</span>
                <span className="text-white font-medium">#{nft.tokenId}</span>
              </div>
            </div>

            {/* Story Content */}
            <div className="card">
              <h2 className="text-xl font-bold text-white mb-4">📖 Complete Story</h2>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-white leading-relaxed">{nft.storyContent}</p>
              </div>
            </div>

            {/* Attributes */}
            <div className="card">
              <h2 className="text-xl font-bold text-white mb-4">✨ Attributes</h2>
              <div className="grid grid-cols-2 gap-3">
                {nft.attributes.map((attr, index) => (
                  <div key={index} className="bg-white/10 rounded-lg p-3">
                    <div className="text-purple-200 text-sm">{attr.trait_type}</div>
                    <div className="text-white font-medium">{attr.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contributors */}
            <div className="card">
              <h2 className="text-xl font-bold text-white mb-4">👥 Story Contributors</h2>
              <div className="space-y-3">
                {nft.creators.map((creator, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{index + 1}</span>
                    </div>
                    <span className="text-purple-200">{formatAddress(creator)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mt-8">
          <button
            onClick={() => router.push('/')}
            className="btn-outline"
          >
            View More NFTs
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Create New Story
          </button>
        </div>
      </div>
    </div>
  );
}