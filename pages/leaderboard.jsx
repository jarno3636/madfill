import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useMiniWallet } from '../hooks/useMiniWallet';
import { useContracts } from '../hooks/useContracts';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatAddress } from '../utils/validation';

export default function Leaderboard() {
  const router = useRouter();
  const { address, isConnected } = useMiniWallet();
  const { contracts } = useContracts();

  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('all'); // all, week, month

  useEffect(() => {
    loadLeaderboard();
  }, [timeframe, contracts]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      
      // In a real app, you'd fetch this from your backend/contract
      // For now, we'll use mock data
      const mockLeaderboard = [
        {
          address: '0x1234567890123456789012345678901234567890',
          username: 'StoryMaster',
          storiesCreated: 15,
          storiesContributed: 42,
          nftsMinted: 8,
          totalEarnings: '2.5',
          rank: 1,
          isCurrentUser: address === '0x1234567890123456789012345678901234567890'
        },
        {
          address: '0x2345678901234567890123456789012345678901',
          username: 'NarrativeNinja',
          storiesCreated: 12,
          storiesContributed: 38,
          nftsMinted: 6,
          totalEarnings: '2.1',
          rank: 2,
          isCurrentUser: false
        },
        {
          address: '0x3456789012345678901234567890123456789012',
          username: 'TaleTeller',
          storiesCreated: 10,
          storiesContributed: 35,
          nftsMinted: 5,
          totalEarnings: '1.8',
          rank: 3,
          isCurrentUser: false
        },
        {
          address: '0x4567890123456789012345678901234567890123',
          username: 'WordWeaver',
          storiesCreated: 8,
          storiesContributed: 32,
          nftsMinted: 4,
          totalEarnings: '1.5',
          rank: 4,
          isCurrentUser: false
        },
        {
          address: '0x5678901234567890123456789012345678901234',
          username: 'PlotPioneer',
          storiesCreated: 7,
          storiesContributed: 28,
          nftsMinted: 3,
          totalEarnings: '1.2',
          rank: 5,
          isCurrentUser: false
        }
      ];

      // Find current user if connected
      if (address) {
        const userIndex = mockLeaderboard.findIndex(user => user.address.toLowerCase() === address.toLowerCase());
        if (userIndex !== -1) {
          mockLeaderboard[userIndex].isCurrentUser = true;
        } else {
          // Add current user if not in top 5
          mockLeaderboard.push({
            address: address,
            username: 'You',
            storiesCreated: 2,
            storiesContributed: 8,
            nftsMinted: 1,
            totalEarnings: '0.3',
            rank: 47,
            isCurrentUser: true
          });
        }
      }

      setLeaderboardData(mockLeaderboard);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🏆';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return 'text-yellow-400';
      case 2: return 'text-gray-300';
      case 3: return 'text-yellow-600';
      default: return 'text-purple-200';
    }
  };

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
        </div>

        {/* Title and Filters */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🏆 MadFill Leaderboard
          </h1>
          <p className="text-purple-200 text-lg mb-6">
            Top storytellers and their achievements
          </p>

          {/* Timeframe Filter */}
          <div className="flex justify-center space-x-2">
            {[
              { key: 'all', label: 'All Time' },
              { key: 'month', label: 'This Month' },
              { key: 'week', label: 'This Week' }
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setTimeframe(option.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeframe === option.key
                    ? 'bg-yellow-500 text-black'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center">
            <LoadingSpinner size="xl" text="Loading leaderboard..." />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Leaderboard Table */}
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-3 px-4 text-purple-200 font-medium">Rank</th>
                      <th className="text-left py-3 px-4 text-purple-200 font-medium">User</th>
                      <th className="text-center py-3 px-4 text-purple-200 font-medium">Stories Created</th>
                      <th className="text-center py-3 px-4 text-purple-200 font-medium">Contributions</th>
                      <th className="text-center py-3 px-4 text-purple-200 font-medium">NFTs Minted</th>
                      <th className="text-center py-3 px-4 text-purple-200 font-medium">Earnings (ETH)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.map((user, index) => (
                      <tr
                        key={user.address}
                        className={`border-b border-white/10 hover:bg-white/5 transition-colors ${
                          user.isCurrentUser ? 'bg-yellow-500/20 border-yellow-500/30' : ''
                        }`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <span className={`text-xl ${getRankColor(user.rank)}`}>
                              {getRankIcon(user.rank)}
                            </span>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {user.username ? user.username[0].toUpperCase() : 'U'}
                              </span>
                            </div>
                            <div>
                              <div className={`font-medium ${user.isCurrentUser ? 'text-yellow-400' : 'text-white'}`}>
                                {user.username || formatAddress(user.address)}
                                {user.isCurrentUser && (
                                  <span className="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded-full">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-purple-200 text-sm">
                                {formatAddress(user.address)}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4 text-center">
                          <span className="text-white font-medium">{user.storiesCreated}</span>
                        </td>
                        
                        <td className="py-4 px-4 text-center">
                          <span className="text-white font-medium">{user.storiesContributed}</span>
                        </td>
                        
                        <td className="py-4 px-4 text-center">
                          <span className="text-white font-medium">{user.nftsMinted}</span>
                        </td>
                        
                        <td className="py-4 px-4 text-center">
                          <span className="text-yellow-400 font-medium">{user.totalEarnings}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="card text-center">
                <div className="text-3xl mb-2">📈</div>
                <h3 className="text-xl font-bold text-white mb-2">Total Stories</h3>
                <p className="text-2xl text-yellow-400 font-bold">1,247</p>
                <p className="text-purple-200 text-sm">Created on MadFill</p>
              </div>
              
              <div className="card text-center">
                <div className="text-3xl mb-2">👥</div>
                <h3 className="text-xl font-bold text-white mb-2">Active Users</h3>
                <p className="text-2xl text-yellow-400 font-bold">389</p>
                <p className="text-purple-200 text-sm">Contributing daily</p>
              </div>
              
              <div className="card text-center">
                <div className="text-3xl mb-2">🎨</div>
                <h3 className="text-xl font-bold text-white mb-2">NFTs Minted</h3>
                <p className="text-2xl text-yellow-400 font-bold">567</p>
                <p className="text-purple-200 text-sm">Unique story NFTs</p>
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center mt-8">
              <div className="card">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Ready to Climb the Leaderboard?
                </h2>
                <p className="text-purple-200 mb-6">
                  Create stories, contribute to others, and mint NFTs to earn your place among the top storytellers!
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="btn-primary"
                >
                  Start Creating Stories
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}