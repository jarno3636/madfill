import { useState, useEffect } from 'react';
import { useMiniWallet } from '../hooks/useMiniWallet';
import { useContracts } from '../hooks/useContracts';
import { useChain } from '../hooks/useChain';
import { useToast } from '../components/Toast';
import { useUserPreferences, useStoryDrafts } from '../hooks/useLocalStorage';
import MiniConnectButton from '../components/MiniConnectButton';
import ChainSwitcher from '../components/ChainSwitcher';
import LoadingSpinner, { LoadingOverlay } from '../components/LoadingSpinner';
import { validateStoryPoolCreation, validateStoryPoolJoin } from '../utils/validation';
import { STORY_THEMES, ENTRY_FEE_OPTIONS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../utils/constants';

export default function Home() {
  const { address, isConnected } = useMiniWallet();
  const { isCorrectChain } = useChain();
  const { addToast } = useToast();
  const { preferences, updatePreference } = useUserPreferences();
  const { drafts, saveDraft, deleteDraft } = useStoryDrafts();
  
  const { 
    contracts, 
    isLoading: contractsLoading, 
    getActiveStoryPools, 
    createStoryPool,
    joinStoryPool,
    getUserNFTs 
  } = useContracts();
  
  const [activePools, setActivePools] = useState([]);
  const [userNFTs, setUserNFTs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');

  // Form states
  const [storyTheme, setStoryTheme] = useState('');
  const [entryFee, setEntryFee] = useState(preferences.defaultEntryFee || '0.01');
  const [customTheme, setCustomTheme] = useState('');

  // Load data when wallet connects
  useEffect(() => {
    if (isConnected && contracts) {
      loadData();
    }
  }, [isConnected, contracts]);

  const loadData = async () => {
    if (!contracts) return;
    
    setLoading(true);
    try {
      // Load active story pools
      const pools = await getActiveStoryPools();
      setActivePools(pools);

      // Load user NFTs if connected
      if (address) {
        const nfts = await getUserNFTs();
        setUserNFTs(nfts);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStoryPool = async (e) => {
    e.preventDefault();
    
    const finalTheme = storyTheme === 'custom' ? customTheme : storyTheme;
    const validation = validateStoryPoolCreation({ theme: finalTheme, entryFee });
    
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        addToast(error.message, 'error');
      });
      return;
    }

    if (!isConnected || !isCorrectChain) {
      addToast(ERROR_MESSAGES.WALLET_NOT_CONNECTED, 'error');
      return;
    }

    setLoading(true);
    try {
      await createStoryPool(finalTheme, entryFee);
      
      // Update user preferences
      updatePreference('defaultEntryFee', entryFee);
      
      // Reset form
      setStoryTheme('');
      setCustomTheme('');
      setEntryFee(preferences.defaultEntryFee || '0.01');
      
      await loadData(); // Refresh pools
      addToast(SUCCESS_MESSAGES.STORY_CREATED, 'success');
    } catch (error) {
      console.error('Error creating story pool:', error);
      addToast(ERROR_MESSAGES.CONTRACT_ERROR + ': ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPool = async (poolId, poolEntryFee) => {
    const contribution = prompt('Enter your story contribution:');
    if (!contribution) return;

    const validation = validateStoryPoolJoin({ poolId, contribution });
    
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        addToast(error.message, 'error');
      });
      return;
    }

    if (!isConnected || !isCorrectChain) {
      addToast(ERROR_MESSAGES.WALLET_NOT_CONNECTED, 'error');
      return;
    }

    setLoading(true);
    try {
      await joinStoryPool(poolId, contribution, poolEntryFee);
      await loadData(); // Refresh pools
      addToast(SUCCESS_MESSAGES.STORY_JOINED, 'success');
    } catch (error) {
      console.error('Error joining pool:', error);
      addToast(ERROR_MESSAGES.CONTRACT_ERROR + ': ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () => {
    const finalTheme = storyTheme === 'custom' ? customTheme : storyTheme;
    if (!finalTheme && !entryFee) return;

    saveDraft({
      theme: finalTheme,
      customTheme: storyTheme === 'custom' ? customTheme : '',
      entryFee,
      type: 'story_pool'
    });
    
    addToast('Draft saved successfully!', 'success');
  };

  const handleLoadDraft = (draft) => {
    setStoryTheme(draft.customTheme ? 'custom' : draft.theme);
    setCustomTheme(draft.customTheme || '');
    setEntryFee(draft.entryFee);
    
    addToast('Draft loaded successfully!', 'info');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🎭 MadFill Stories
          </h1>
          <p className="text-purple-200 text-lg">
            Create collaborative stories and mint them as NFTs
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center mb-8">
          <MiniConnectButton />
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-6 py-2 rounded-md transition-all ${
                activeTab === 'create'
                  ? 'bg-yellow-500 text-black font-semibold'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Create Story
            </button>
            <button
              onClick={() => setActiveTab('pools')}
              className={`px-6 py-2 rounded-md transition-all ${
                activeTab === 'pools'
                  ? 'bg-yellow-500 text-black font-semibold'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Active Pools
            </button>
            <button
              onClick={() => setActiveTab('nfts')}
              className={`px-6 py-2 rounded-md transition-all ${
                activeTab === 'nfts'
                  ? 'bg-yellow-500 text-black font-semibold'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              My NFTs
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto">
          {/* Create Story Tab */}
          {activeTab === 'create' && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Create New Story Pool</h2>
              
              {!isConnected ? (
                <div className="text-center text-purple-200">
                  Please connect your wallet to create a story pool
                </div>
              ) : (
                <form onSubmit={handleCreateStoryPool} className="space-y-6">
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Story Theme
                    </label>
                    <input
                      type="text"
                      value={storyTheme}
                      onChange={(e) => setStoryTheme(e.target.value)}
                      placeholder="e.g., Space Adventure, Mystery Detective, Fantasy Quest..."
                      className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-purple-300 focus:border-yellow-500 focus:outline-none"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Entry Fee (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={entryFee}
                      onChange={(e) => setEntryFee(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-purple-300 focus:border-yellow-500 focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || contractsLoading}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating...' : 'Create Story Pool'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Active Pools Tab */}
          {activeTab === 'pools' && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Active Story Pools</h2>
              
              {loading ? (
                <div className="text-center text-purple-200">Loading pools...</div>
              ) : activePools.length === 0 ? (
                <div className="text-center text-purple-200">No active pools found</div>
              ) : (
                <div className="grid gap-6">
                  {activePools.map((pool, index) => (
                    <div key={index} className="bg-white/20 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-white">{pool.theme}</h3>
                          <p className="text-purple-200">Entry Fee: {pool.entryFee} ETH</p>
                          <p className="text-purple-200">Participants: {pool.participantCount}</p>
                        </div>
                        {isConnected && (
                          <button
                            onClick={() => handleJoinPool(pool.id, pool.entryFee)}
                            disabled={loading}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Join Pool
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* My NFTs Tab */}
          {activeTab === 'nfts' && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">My Story NFTs</h2>
              
              {!isConnected ? (
                <div className="text-center text-purple-200">
                  Please connect your wallet to view your NFTs
                </div>
              ) : loading ? (
                <div className="text-center text-purple-200">Loading NFTs...</div>
              ) : userNFTs.length === 0 ? (
                <div className="text-center text-purple-200">No NFTs found</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {userNFTs.map((nftId, index) => (
                    <div key={index} className="bg-white/20 rounded-lg p-6">
                      <div className="aspect-square bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg mb-4 flex items-center justify-center">
                        <span className="text-white text-lg font-bold">#{nftId}</span>
                      </div>
                      <h3 className="text-white font-semibold">Story NFT #{nftId}</h3>
                      <p className="text-purple-200 text-sm">Collaborative Story</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}