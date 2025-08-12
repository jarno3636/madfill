import { useMiniWallet } from '../hooks/useMiniWallet'

export default function MiniConnectButton({ className = '' }) {
  const { address, isConnected, isLoading, connect, disconnect, error, isInFarcaster } = useMiniWallet()

  const handleClick = async () => {
    if (isConnected) {
      await disconnect()
    } else {
      await connect()
    }
  }

  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Show connection type for development
  const connectionType = isInFarcaster ? 'Farcaster' : 'Browser'

  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`
          px-6 py-3 rounded-lg font-semibold transition-all duration-200
          ${isConnected
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {isLoading ? (
          <span className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Connecting...</span>
          </span>
        ) : isConnected ? (
          `Disconnect ${formatAddress(address)}`
        ) : (
          `Connect ${connectionType} Wallet`
        )}
      </button>

      {error && (
        <div className="text-red-500 text-sm text-center max-w-xs">
          Error: {error.message}
        </div>
      )}

      {isConnected && address && (
        <div className="text-sm text-gray-300 text-center">
          <div>Connected via {connectionType}</div>
          <div className="font-mono">{formatAddress(address)}</div>
        </div>
      )}
    </div>
  )
}