import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useMiniWallet } from '../../hooks/useMiniWallet';
import { useContracts } from '../../hooks/useContracts';
import { useToast } from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatTimeAgo, formatAddress } from '../../utils/validation';

export default function StoryPoolDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { address, isConnected } = useMiniWallet();
  const { contracts, joinStoryPool, getActiveStoryPools } = useContracts();
  const { addToast } = useToast();

  const [pool, setPool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [contribution, setContribution] = useState('');
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (id && contracts) {
      loadPoolDetails();
    }
  }, [id, contracts]);

  const loadPoolDetails = async () => {
    try {
      setLoading(true);
      const pools = await getActiveStoryPools();
      const foundPool = pools.find(p => p.id.toString() === id);
      
      if (foundPool) {
        setPool(foundPool);
        // In a real app, you'd fetch participant details from your backend
        // For now, we'll show mock participant data
        setParticipants([
          { address: foundPool.creator, contribution: 'Started the story...', timestamp: Date.now() - 3600000 }
        ]);
      } else {
        addToast('Story pool not found', 'error');
        router.push('/');
      }
    } catch (error) {
      console.error('Error loading pool details:', error);
      addToast('Failed to load story pool details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPool = async (e) => {
    e.preventDefault();
    if (!contribution.trim()) {
      addToast('Please enter a story contribution', 'error');
      return;
    }

    if (!isConnected) {
      addToast('Please connect your wallet first', 'error');
      return;
    }

    setJoining(true);
    try {
      await joinStoryPool(pool.id, contribution, pool.entryFee);
      addToast('Successfully joined the story pool!', 'success');
      setContribution('');
      loadPoolDetails(); // Refresh data
    } catch (error) {
      console.error('Error joining pool:', error);
      addToast('Failed to join story pool: ' + error.message, 'error');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <LoadingSpinner size="xl" text="Loading story pool..." />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Story Pool Not Found</h2>
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
            ← Back to Pools
          </button>
        </div>

        {/* Pool Info */}
        <div className="card mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{pool.theme}</h1>
              <p className="text-purple-200">Entry Fee: {pool.entryFee} ETH</p>
              <p className="text-purple-200">Participants: {pool.participantCount}</p>
              <p className="text-purple-200 text-sm">
                Created by: {formatAddress(pool.creator)}
              </p>
            </div>
            
            <div className="text-right">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                pool.isActive ? 'bg-green-500 text-black' : 'bg-red-500 text-white'
              }`}>
                {pool.isActive ? 'Active' : 'Closed'}
              </div>
            </div>
          </div>
        </div>

        {/* Story Contributions */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Story So Far</h2>
          
          {participants.length === 0 ? (
            <p className="text-purple-200 text-center py-8">
              No contributions yet. Be the first to add to this story!
            </p>
          ) : (
            <div className="space-y-4">
              {participants.map((participant, index) => (
                <div key={index} className="bg-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-yellow-400 font-medium">
                      {formatAddress(participant.address)}
                    </span>
                    <span className="text-purple-200 text-sm">
                      {formatTimeAgo(participant.timestamp)}
                    </span>
                  </div>
                  <p className="text-white">{participant.contribution}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Join Pool Form */}
        {pool.isActive && isConnected && (
          <div className="card">
            <h2 className="text-xl font-bold text-white mb-4">Add Your Contribution</h2>
            
            <form onSubmit={handleJoinPool} className="space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Your Story Contribution
                </label>
                <textarea
                  value={contribution}
                  onChange={(e) => setContribution(e.target.value)}
                  placeholder="Continue the story... What happens next?"
                  className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-purple-300 focus:border-yellow-500 focus:outline-none resize-none"
                  rows={4}
                  maxLength={500}
                  required
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-purple-200 text-xs">
                    Add your creative touch to this collaborative story
                  </p>
                  <span className="text-purple-200 text-xs">
                    {contribution.length}/500
                  </span>
                </div>
              </div>

              <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4">
                <p className="text-yellow-200 text-sm">
                  Entry fee: <strong>{pool.entryFee} ETH</strong>
                </p>
                <p className="text-yellow-100 text-xs mt-1">
                  This fee will be charged when you submit your contribution
                </p>
              </div>

              <button
                type="submit"
                disabled={joining || !contribution.trim()}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joining ? 'Joining Pool...' : `Join Pool (${pool.entryFee} ETH)`}
              </button>
            </form>
          </div>
        )}

        {/* Not Connected State */}
        {pool.isActive && !isConnected && (
          <div className="card text-center">
            <h2 className="text-xl font-bold text-white mb-4">Connect to Participate</h2>
            <p className="text-purple-200 mb-6">
              Connect your wallet to add your contribution to this story
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {/* Pool Closed State */}
        {!pool.isActive && (
          <div className="card text-center">
            <h2 className="text-xl font-bold text-white mb-4">Story Pool Closed</h2>
            <p className="text-purple-200 mb-6">
              This story pool is no longer accepting contributions
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary"
            >
              Find Active Pools
            </button>
          </div>
        )}
      </div>
    </div>
  );
}