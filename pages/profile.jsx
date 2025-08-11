import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useMiniWallet } from '../hooks/useMiniWallet';
import { useContracts } from '../hooks/useContracts';
import { useUserPreferences, useStoryDrafts } from '../hooks/useLocalStorage';
import { useToast } from '../components/Toast';
import { useNotifications } from '../hooks/useNotifications';
import LoadingSpinner from '../components/LoadingSpinner';
import ChainSwitcher from '../components/ChainSwitcher';
import { formatAddress, formatTokenAmount } from '../utils/validation';

export default function Profile() {
  const router = useRouter();
  const { address, isConnected, disconnect } = useMiniWallet();
  const { contracts, getUserNFTs } = useContracts();
  const { preferences, updatePreference, resetPreferences } = useUserPreferences();
  const { drafts, clearAllDrafts } = useStoryDrafts();
  const { addToast } = useToast();
  const { permission, requestPermission, isSupported } = useNotifications();

  const [userStats, setUserStats] = useState(null);
  const [userNFTs, setUserNFTs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    if (isConnected && address) {
      loadUserData();
    } else {
      setLoading(false);
    }
  }, [isConnected, address, contracts]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      // Load user stats (mock data for now)
      const mockStats = {
        storiesCreated: 5,
        storiesContributed: 23,
        nftsMinted: 3,
        totalEarnings: '1.25',
        joinDate: '2024-01-15',
        rank: 42,
        favoriteTheme: 'Space Adventure'
      };
      setUserStats(mockStats);

      // Load user NFTs
      if (contracts) {
        const nftIds = await getUserNFTs();
        setUserNFTs(nftIds);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      addToast('Failed to load profile data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      addToast('Wallet disconnected', 'info');
      router.push('/');
    } catch (error) {
      console.error('Error disconnecting:', error);
      addToast('Failed to disconnect wallet', 'error');
    }
  };

  const handleNotificationToggle = async () => {
    if (permission === 'granted') {
      updatePreference('notifications', !preferences.notifications);
      addToast(
        preferences.notifications ? 'Notifications disabled' : 'Notifications enabled', 
        'info'
      );
    } else {
      const granted = await requestPermission();
      if (granted) {
        updatePreference('notifications', true);
      }
    }
  };

  const handleClearDrafts = () => {
    if (window.confirm('Are you sure you want to clear all story drafts? This cannot be undone.')) {
      clearAllDrafts();
      addToast('All drafts cleared', 'success');
    }
  };

  const handleResetPreferences = () => {
    if (window.confirm('Are you sure you want to reset all preferences to default? This cannot be undone.')) {
      resetPreferences();
      addToast('Preferences reset to default', 'success');
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="card text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-4">Profile</h1>
          <p className="text-purple-200 mb-6">
            Please connect your wallet to view your profile
          </p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Connect Wallet
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
            ← Back to Home
          </button>
          
          <button
            onClick={handleDisconnect}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            Disconnect Wallet
          </button>
        </div>

        {/* Profile Header */}
        <div className="card mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">
                {formatAddress(address)[2].toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Your Profile</h1>
              <p className="text-purple-200">{formatAddress(address)}</p>
              {userStats && (
                <p className="text-yellow-400 text-sm">Rank #{userStats.rank} • Joined {new Date(userStats.joinDate).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {/* Chain Switcher */}
          <ChainSwitcher className="mb-4" />
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1">
            {[
              { key: 'stats', label: '📊 Stats', icon: '📊' },
              { key: 'nfts', label: '🎨 My NFTs', icon: '🎨' },
              { key: 'drafts', label: '📝 Drafts', icon: '📝' },
              { key: 'settings', label: '⚙️ Settings', icon: '⚙️' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-2 rounded-md transition-all ${
                  activeTab === tab.key
                    ? 'bg-yellow-500 text-black font-semibold'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center">
            <LoadingSpinner size="xl" text="Loading profile..." />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Stats Tab */}
            {activeTab === 'stats' && userStats && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="card text-center">
                  <div className="text-3xl mb-2">📖</div>
                  <h3 className="text-xl font-bold text-white mb-2">Stories Created</h3>
                  <p className="text-3xl text-yellow-400 font-bold">{userStats.storiesCreated}</p>
                </div>
                
                <div className="card text-center">
                  <div className="text-3xl mb-2">✍️</div>
                  <h3 className="text-xl font-bold text-white mb-2">Contributions</h3>
                  <p className="text-3xl text-yellow-400 font-bold">{userStats.storiesContributed}</p>
                </div>
                
                <div className="card text-center">
                  <div className="text-3xl mb-2">🎨</div>
                  <h3 className="text-xl font-bold text-white mb-2">NFTs Minted</h3>
                  <p className="text-3xl text-yellow-400 font-bold">{userStats.nftsMinted}</p>
                </div>
                
                <div className="card text-center">
                  <div className="text-3xl mb-2">💰</div>
                  <h3 className="text-xl font-bold text-white mb-2">Total Earnings</h3>
                  <p className="text-3xl text-yellow-400 font-bold">{userStats.totalEarnings} ETH</p>
                </div>
                
                <div className="card text-center">
                  <div className="text-3xl mb-2">🏆</div>
                  <h3 className="text-xl font-bold text-white mb-2">Current Rank</h3>
                  <p className="text-3xl text-yellow-400 font-bold">#{userStats.rank}</p>
                </div>
                
                <div className="card text-center">
                  <div className="text-3xl mb-2">🎭</div>
                  <h3 className="text-xl font-bold text-white mb-2">Favorite Theme</h3>
                  <p className="text-lg text-yellow-400 font-bold">{userStats.favoriteTheme}</p>
                </div>
              </div>
            )}

            {/* NFTs Tab */}
            {activeTab === 'nfts' && (
              <div className="card">
                <h2 className="text-2xl font-bold text-white mb-6">Your Story NFTs</h2>
                
                {userNFTs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎨</div>
                    <h3 className="text-xl font-bold text-white mb-2">No NFTs Yet</h3>
                    <p className="text-purple-200 mb-6">
                      Create and complete stories to mint your first NFT!
                    </p>
                    <button
                      onClick={() => router.push('/')}
                      className="btn-primary"
                    >
                      Create Your First Story
                    </button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-6">
                    {userNFTs.map((nftId, index) => (
                      <div
                        key={index}
                        onClick={() => router.push(`/nft/${nftId}`)}
                        className="card-hover cursor-pointer"
                      >
                        <div className="aspect-square bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg mb-4 flex items-center justify-center">
                          <span className="text-white text-2xl font-bold">#{nftId}</span>
                        </div>
                        <h3 className="text-white font-semibold">Story NFT #{nftId}</h3>
                        <p className="text-purple-200 text-sm">Collaborative Story</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Drafts Tab */}
            {activeTab === 'drafts' && (
              <div className="card">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">Story Drafts</h2>
                  {drafts.length > 0 && (
                    <button
                      onClick={handleClearDrafts}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear All Drafts
                    </button>
                  )}
                </div>
                
                {drafts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-bold text-white mb-2">No Drafts Saved</h3>
                    <p className="text-purple-200">
                      Your story drafts will appear here automatically as you create them
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {drafts.map((draft) => (
                      <div key={draft.id} className="bg-white/10 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-white font-semibold">{draft.theme}</h3>
                          <span className="text-purple-200 text-sm">
                            {new Date(draft.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-purple-200 text-sm mb-3">
                          Entry Fee: {draft.entryFee} ETH
                        </p>
                        <button
                          onClick={() => {
                            // You'd implement loading the draft back into the create form
                            router.push('/?loadDraft=' + draft.id);
                          }}
                          className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm"
                        >
                          Load Draft →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="card">
                <h2 className="text-2xl font-bold text-white mb-6">Preferences</h2>
                
                <div className="space-y-6">
                  {/* Notifications */}
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                    <div>
                      <h3 className="text-white font-medium">Browser Notifications</h3>
                      <p className="text-purple-200 text-sm">
                        Get notified about story updates and new contributions
                      </p>
                    </div>
                    <button
                      onClick={handleNotificationToggle}
                      disabled={!isSupported}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        preferences.notifications && permission === 'granted'
                          ? 'bg-green-500 text-black'
                          : 'bg-gray-500 text-white'
                      } disabled:opacity-50`}
                    >
                      {!isSupported ? 'Not Supported' : 
                       permission === 'granted' && preferences.notifications ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {/* Default Entry Fee */}
                  <div className="p-4 bg-white/10 rounded-lg">
                    <h3 className="text-white font-medium mb-2">Default Entry Fee</h3>
                    <input
                      type="number"
                      step="0.001"
                      value={preferences.defaultEntryFee}
                      onChange={(e) => updatePreference('defaultEntryFee', e.target.value)}
                      className="input-primary w-32"
                    />
                    <p className="text-purple-200 text-sm mt-1">
                      Your preferred entry fee for new story pools
                    </p>
                  </div>

                  {/* Auto Connect */}
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                    <div>
                      <h3 className="text-white font-medium">Auto Connect Wallet</h3>
                      <p className="text-purple-200 text-sm">
                        Automatically connect your wallet when visiting the app
                      </p>
                    </div>
                    <button
                      onClick={() => updatePreference('autoConnect', !preferences.autoConnect)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        preferences.autoConnect
                          ? 'bg-green-500 text-black'
                          : 'bg-gray-500 text-white'
                      }`}
                    >
                      {preferences.autoConnect ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {/* Reset Button */}
                  <div className="pt-4 border-t border-white/20">
                    <button
                      onClick={handleResetPreferences}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Reset All Preferences to Default
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}