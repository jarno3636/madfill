import { useMiniWallet } from '../hooks/useMiniWallet';

export function WalletConnectButton({ children, className = '', onConnected, ...props }) {
  const { address, isConnected, isLoading, connect, disconnect, error } = useMiniWallet();

  const handleConnect = async () => {
    try {
      if (!isConnected) {
        await connect();
        if (onConnected) {
          onConnected(address);
        }
      } else {
        await disconnect();
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className={`
        inline-flex items-center justify-center
        px-4 py-2 border border-transparent text-sm font-medium rounded-md
        transition-colors duration-200
        ${isConnected 
          ? 'text-red-700 bg-red-100 hover:bg-red-200' 
          : 'text-white bg-blue-600 hover:bg-blue-700'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
          Connecting...
        </>
      ) : isConnected ? (
        children || `Disconnect ${formatAddress(address)}`
      ) : (
        children || 'Connect Wallet'
      )}
      
      {error && (
        <span className="ml-2 text-red-500" title={error.message}>
          ⚠️
        </span>
      )}
    </button>
  );
}

export default WalletConnectButton;