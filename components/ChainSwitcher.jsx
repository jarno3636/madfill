import { useChain } from '../hooks/useChain';
import { useMiniWallet } from '../hooks/useMiniWallet';

export default function ChainSwitcher({ className = '' }) {
  const { isConnected } = useMiniWallet();
  const { 
    currentChain, 
    isCorrectChain, 
    switching, 
    supportedChains, 
    switchToChain,
    switchToDefaultChain 
  } = useChain();

  if (!isConnected) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {!isCorrectChain && (
        <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-yellow-200 font-semibold">Wrong Network</h3>
              <p className="text-yellow-100 text-sm">
                Please switch to a supported network to use MadFill
              </p>
            </div>
            <button
              onClick={switchToDefaultChain}
              disabled={switching}
              className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {switching ? 'Switching...' : 'Switch Network'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-medium">Network:</span>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isCorrectChain ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-white text-sm">
              {currentChain ? currentChain.name : 'Unknown Network'}
            </span>
          </div>
        </div>

        {isCorrectChain && (
          <div className="space-y-2">
            <p className="text-purple-200 text-xs">Supported Networks:</p>
            <div className="flex flex-wrap gap-2">
              {supportedChains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => switchToChain(chain.id)}
                  disabled={switching || chain.id === currentChain?.id}
                  className={`px-3 py-1 rounded-md text-xs transition-colors ${
                    chain.id === currentChain?.id
                      ? 'bg-green-500 text-black font-medium'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  } disabled:opacity-50`}
                >
                  {chain.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}