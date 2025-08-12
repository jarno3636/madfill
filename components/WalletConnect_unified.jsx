import { useState } from 'react';
import { useFarcaster } from './FarcasterProvider_unified';
import { useMiniWallet } from '../CLEANED_hooks/useMiniWallet_unified';

export default function WalletConnect() {
  const { user, isAuthenticated, signIn } = useFarcaster();
  const { address, isConnected, connect } = useMiniWallet();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      if (isAuthenticated) {
        // User is already authenticated via Farcaster
        await connect();
      } else {
        // Need to sign in first
        await signIn();
        await connect();
      }
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect wallet: ' + error.message);
    } finally {
      setConnecting(false);
    }
  };

  if (isConnected && isAuthenticated) {
    return (
      <div className="flex items-center space-x-3">
        {user?.pfpUrl && (
          <img 
            src={user.pfpUrl} 
            alt="Profile" 
            className="w-8 h-8 rounded-full"
            onError={(e) => { e.target.src = '/default.png'; }}
          />
        )}
        <div className="text-sm">
          <div className="text-green-400 font-semibold">
            Connected
          </div>
          <div className="text-gray-300">
            {user?.username || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-6 rounded-full transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}