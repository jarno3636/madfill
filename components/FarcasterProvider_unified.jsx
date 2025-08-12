import { createContext, useContext, useEffect, useState } from 'react';

const FarcasterContext = createContext();

export function FarcasterProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFarcasterEnvironment, setIsFarcasterEnvironment] = useState(false);

  useEffect(() => {
    const initializeFarcaster = async () => {
      try {
        // Detect Farcaster environment
        const isInFarcaster = typeof window !== 'undefined' && 
          (window.parent !== window || window.location.pathname.startsWith('/mini'));
        
        setIsFarcasterEnvironment(isInFarcaster);

        if (isInFarcaster) {
          // Import Farcaster SDK dynamically
          const { MiniAppSDK } = await import('@farcaster/miniapp-sdk');
          const sdk = new MiniAppSDK();
          
          // Get user context
          const context = await sdk.context;
          
          if (context?.user) {
            setUser({
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl,
              custodyAddress: context.user.custodyAddress,
            });
          }
        } else {
          // Development/browser fallback
          setUser({
            fid: 1,
            username: 'dev-user',
            displayName: 'Developer',
            pfpUrl: '/default.png',
            custodyAddress: '0x1234567890123456789012345678901234567890',
          });
        }
        
        setIsLoading(false);
      } catch (err) {
        console.warn('Farcaster SDK initialization failed:', err);
        
        // Fallback user for development
        setUser({
          fid: 1,
          username: 'dev-user',
          displayName: 'Developer',
          pfpUrl: '/default.png',
          custodyAddress: '0x0000000000000000000000000000000000000000',
        });
        setError('Running in development mode');
        setIsLoading(false);
      }
    };

    initializeFarcaster();
  }, []);

  const signIn = async () => {
    if (isFarcasterEnvironment) {
      try {
        const { MiniAppSDK } = await import('@farcaster/miniapp-sdk');
        const sdk = new MiniAppSDK();
        const result = await sdk.actions.signIn();
        
        if (!result.isError) {
          setUser(result.data);
          return result.data;
        }
        throw new Error(result.error?.message || 'Sign in failed');
      } catch (err) {
        setError(err.message);
        throw err;
      }
    } else {
      // Development mode - simulate sign in
      const mockUser = {
        fid: Math.floor(Math.random() * 10000),
        username: `user${Math.floor(Math.random() * 1000)}`,
        displayName: 'Test User',
        pfpUrl: '/default.png',
        custodyAddress: '0x' + Math.random().toString(16).substr(2, 40),
      };
      setUser(mockUser);
      return mockUser;
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    isFarcasterEnvironment,
    signIn,
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
}

export function useFarcaster() {
  const context = useContext(FarcasterContext);
  if (context === undefined) {
    throw new Error('useFarcaster must be used within a FarcasterProvider');
  }
  return context;
}

export default FarcasterProvider;